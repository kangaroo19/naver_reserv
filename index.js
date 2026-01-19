// https://blog.naver.com/tact_1663/223340585668 녹화본있음

//2026-01-11
// 5시 57초에 실행했는데 6시 이전이라 안 열렸었음 그래서 바로 끄고 6시 3초에 들어갔는데도
// 성공적으로 예약됨
// 다음엔 58초에 실행해보기

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

/**
 * 사용자 입력 받는 함수
 * @param {*} query 질문 문자열 ex) "네이버 아이디를 입력하세요: "
 * @param {*} providedAnswer 테스트/자동화를 위한 사전 제공 답변 (옵션)
 */
function askQuestion(query, providedAnswer) {
  if (providedAnswer !== undefined) {
    try {
      process.stdout.write(`${query}${String(providedAnswer)}\n`);
    } catch {}
    return Promise.resolve(providedAnswer);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

const { FileLogger } = require("./logger");
const logger = new FileLogger({ logFileName: "kitchen205.log" });

function resolveChromedriverPath() {
  const besideExe = path.join(logger.baseDir, "chromedriver.exe");
  if (fs.existsSync(besideExe)) return besideExe;
  try {
    // 개발 환경(node 실행)에서는 node_modules의 chromedriver 경로를 사용
    const chromedriver = require("chromedriver");
    if (chromedriver && chromedriver.path && fs.existsSync(chromedriver.path)) {
      return chromedriver.path;
    }
  } catch {
    // ignore
  }
  return null;
}

async function hasNaverLoginCookies(driver) {
  const required = new Set(["NID_AUT", "nid_inf", "NID_SES"]);
  const cookies = await driver.manage().getCookies();
  const names = new Set(cookies.map((c) => c.name));
  for (const n of required) {
    if (!names.has(n)) return false;
  }
  return true;
}

async function waitForLoginCookies(
  driver,
  timeoutMs = 180000,
  intervalMs = 1000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await hasNaverLoginCookies(driver)) return true;
    } catch {}
    await sleep(intervalMs);
  }
  return false;
}

const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

// 상품 선택에 따른 기본 URL 매핑
const PRODUCT_URLS = {
  1: "https://m.booking.naver.com/booking/6/bizes/563788/items/4034774", // 잠실 딸기밭케이크 1호
  2: "https://m.booking.naver.com/booking/6/bizes/563788/items/4035008", // 잠실 딸기밭케이크 미니
  999: "https://m.booking.naver.com/booking/6/bizes/551459/items/4033824", // 테스트용
};

// START_DATE, START_DATE_TIEM 의 yyyy-mm-dd 값은 같아야함

async function naverReserv(naverId, startDate, startDateTime, basicUrl) {
  const options = new chrome.Options();
  options.addArguments(`user-data-dir=C:\\user_data\\${naverId}`);

  logger.log("INFO", "naverReserv start");
  let driver;
  try {
    // WebDriver 초기화
    logger.log("INFO", "creating WebDriver");
    const driverPath = resolveChromedriverPath();
    if (!driverPath) {
      throw new Error(
        "chromedriver.exe를 찾지 못했습니다. dist\\chromedriver.exe가 app.exe와 같은 폴더에 있어야 합니다.",
      );
    }
    logger.log("INFO", "using chromedriver", {
      driverPath,
      exists: fs.existsSync(driverPath),
    });

    const service = new chrome.ServiceBuilder(driverPath);
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeService(service)
      .setChromeOptions(options)
      .build();

    // 로그인 쿠키 확인 및 유도
    const url = `${basicUrl}?area=bmp&lang=ko&map-search=1&service-target=map-pc&startDate=${startDate}&startDateTime=${startDateTime}&theme=place`;
    logger.log("INFO", "페이지 이동", url);
    await driver.get(url);
    logger.log("INFO", "로그인 상태 점검");
    const loggedIn = await hasNaverLoginCookies(driver);
    if (!loggedIn) {
      logger.log("INFO", "로그인 필요: 로그인 페이지로 이동");
      await driver.get(
        "https://nid.naver.com/nidlogin.login?realname=Y&svctype=262144",
      );
      await waitForLoginCookies(driver, 180000).catch(() => {});
      logger.log(
        "INFO",
        "로그인 완료/타임아웃 처리 후 브라우저 종료. 다음 실행에서 예약 진행",
      );
      await driver.quit();
      return;
    }

    // 페이지 열기

    logger.log("INFO", "페이지 로드 완료");

    logger.log("INFO", "페이지 하단으로 스크롤");
    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)",
    );
    await sleep(300);

    logger.log("INFO", "다음 버튼 찾기 시작");

    // 결제창으로 넘어가는 '다음' 버튼 찾기위한 객체
    const findNextButtonLocation = By.xpath(
      '//*[@id="root"]/main/div[4]/div/button',
    );
    const nextButton = await driver.wait(
      until.elementLocated(findNextButtonLocation),
      10000,
    );
    logger.log("INFO", "다음 버튼 찾기 완료");

    logger.log("INFO", "다음 버튼 뷰포트로 스크롤");

    // '다읍' 버튼 뷰포트로 스크롤
    await driver.executeScript(
      "arguments[0].scrollIntoView({block:'center', inline:'center'});",
      nextButton,
    );

    // 가시성/활성 대기
    logger.log("INFO", "다음 버튼 가시성/활성 대기");
    await driver.wait(until.elementIsVisible(nextButton), 5000);
    await driver.wait(until.elementIsEnabled(nextButton), 5000);

    // 클릭 시도 → 실패하면 JS 클릭 백업
    logger.log("INFO", "다음 버튼 클릭 시도");
    try {
      await nextButton.click();
      logger.log("INFO", "다음 버튼 클릭 완료");
    } catch (e) {
      logger.log("WARN", "표준 클릭 실패, JS 클릭으로 대체", e);
      await driver.executeScript("arguments[0].click();", nextButton);
    }

    await sleep(500); // 이거 없으면 하단 클릭이벤트 안먹음

    const checkboxes = await driver.findElements(By.tagName("label"));
    for (const checkbox of checkboxes) {
      const isChecked = await checkbox.isSelected();
      if (!isChecked) {
        await checkbox.click();
      }
    }
    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)",
    );
    logger.log("INFO", "모든 체크박스에 체크 완료");

    // 예약하기 버튼 찾기
    logger.log("INFO", "예약하기 버튼 찾기 시작");
    const payBtnLocator = By.xpath(
      "//button[normalize-space(.)='동의하고 예약하기']",
    );

    const payBtn = await driver.wait(
      until.elementLocated(payBtnLocator),
      10000,
    );
    logger.log("INFO", "결제하기 버튼 찾기 완료");
    logger.log("INFO", "결제하기 버튼 뷰포트로 스크롤");
    await driver.executeScript(
      "arguments[0].scrollIntoView({block:'center', inline:'center'});",
      payBtn,
    );

    await driver.wait(until.elementIsVisible(payBtn), 5000).catch(() => {});
    await driver.wait(until.elementIsEnabled(payBtn), 5000).catch(() => {});

    logger.log("INFO", "결제하기 버튼 클릭 시도");
    try {
      await payBtn.click();
      logger.log("INFO", "결제하기 버튼 클릭 완료");
    } catch {
      await driver.executeScript("arguments[0].click();", payBtn);
    }
    logger.log("INFO", "예약 성공");
  } catch (err) {
    logger.log("ERROR", "naverReserv error", err);
    console.error("에러 발생:", err);
  } finally {
    logger.log("INFO", "naverReserv end");
    // 브라우저 닫기
    // await driver.quit();
  }
}

async function main() {
  try {
    const naverId = await askQuestion("네이버 아이디를 입력하세요 : ");
    // 상품 선택 입력 및 검증 루프
    let productChoice;
    while (true) {
      productChoice = (
        await askQuestion(
          "어떤 상품을 선택하시겠습니까? (숫자만 입력 ex)1 )\n1)  잠실 롯데월드몰점 딸기밭케이크 1호 \n2) 잠실 롯데월드몰점 딸기밭케이크 미니\n> ",
        )
      ).trim();
      if (PRODUCT_URLS[productChoice]) break;
      console.log("유효한 선택지가 아닙니다. 1 또는 2를 입력해주세요.");
    }
    const basicUrl = PRODUCT_URLS[productChoice];
    logger.log("INFO", "선택한 상품", { productChoice, basicUrl });
    const startDate = await askQuestion(
      "예약 날짜를 입력하세요 (예: 2026-01-17): ",
    );
    const startTimeInput = await askQuestion(
      "예약 시간을 입력하세요 (30분 단위, HHMM 형식, 예: 1600): ",
    );

    // HHMM 형식으로 입력받았을 경우 HH:MM으로 변환
    let startTime = startTimeInput;
    if (startTime.length === 4 && !startTime.includes(":")) {
      startTime = `${startTime.substring(0, 2)}:${startTime.substring(2)}`;
    }

    // 날짜 포맷 예시: 2026-01-17T16:00:00+09:00
    // URL 컴포넌트 인코딩
    const startDateTime = encodeURIComponent(
      `${startDate}T${startTime}:00+09:00`,
    );

    const productChoiceName =
      productChoice === "1"
        ? "잠실 롯데월드몰점 딸기밭케이크 1호"
        : "잠실 롯데월드몰점 딸기밭케이크 미니";

    console.log(
      `\n\n\n입력된 정보: ${naverId}, ${startDate}, ${startTime}, ${productChoiceName} `,
    );

    await askQuestion(
      "\n\n실행하시겠습니까? 엔터키를 입력하면 바로 실행됩니다",
    );

    await naverReserv(naverId, startDate, startDateTime, basicUrl);
  } catch (e) {
    console.error("Main execution failed:", e);
    logger.log("FATAL", "Main execution failed", e);
  }
}

main();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
