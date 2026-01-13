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
    })
  );
}

const { FileLogger } = require("./logger");
const logger = new FileLogger();

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

const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

// const BASIC_URL = "https://m.booking.naver.com/booking/13/bizes/987076/items/5336963"; // 실제로 사용할거
const BASIC_URL =
  "https://m.booking.naver.com/booking/6/bizes/563788/items/4035008"; // 테스트용

// START_DATE, START_DATE_TIEM 의 yyyy-mm-dd 값은 같아야함

async function naverReserv(userName, startDate, startDateTime) {
  const options = new chrome.Options();
  options.addArguments(`user-data-dir=C:\\user_data\\${userName}`);

  logger.log("INFO", "naverReserv start");
  let driver;
  try {
    // WebDriver 초기화
    logger.log("INFO", "creating WebDriver");
    const driverPath = resolveChromedriverPath();
    if (!driverPath) {
      throw new Error(
        "chromedriver.exe를 찾지 못했습니다. dist\\chromedriver.exe가 app.exe와 같은 폴더에 있어야 합니다."
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

    // 페이지 열기
    const url = `${BASIC_URL}?area=bmp&lang=ko&map-search=1&service-target=map-pc&startDate=${startDate}&startDateTime=${startDateTime}&theme=place`;
    logger.log("INFO", "navigating", url);
    await driver.get(url);
    logger.log("INFO", "page loaded");

    logger.log("INFO", "scrolling to bottom");
    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)"
    );
    await sleep(300);

    // 로그인 화면 넘어가는 버튼
    logger.log("INFO", "waiting next button");
    const nextButton = await driver.wait(
      until.elementLocated(
        By.xpath('//*[@id="root"]/main/div[4]/div/button[2]')
      ),
      10000
    );

    logger.log("INFO", "next button located");

    // 클릭 가능한지 확인하고 클릭
    logger.log("INFO", "waiting next button visible");
    await driver.wait(until.elementIsVisible(nextButton), 10000);
    logger.log("INFO", "clicking next button");
    await nextButton.click();
    logger.log("INFO", "clicked next button");
  } catch (err) {
    logger.log("ERROR", "naverReserv error", err);
    console.error("에러 발생:", err);
  } finally {
    logger.log("INFO", "naverReserv finally");
    // 브라우저 닫기
    // await driver.quit();
  }
}

async function main() {
  try {
    const userName = await askQuestion(
      "네이버 아이디를 입력하세요 : ",
      "1000jjj"
    );
    const startDate = await askQuestion(
      "예약 날짜를 입력하세요 (예: 2026-01-17): ",
      "2026-01-16"
    );
    const startTimeInput = await askQuestion(
      "예약 시간을 입력하세요 (30분 단위, HHMM 형식, 예: 1600): ",
      "1300"
    );

    // HHMM 형식으로 입력받았을 경우 HH:MM으로 변환
    let startTime = startTimeInput;
    if (startTime.length === 4 && !startTime.includes(":")) {
      startTime = `${startTime.substring(0, 2)}:${startTime.substring(2)}`;
    }

    // 날짜 포맷 예시: 2026-01-17T16:00:00+09:00
    // URL 컴포넌트 인코딩
    const startDateTime = encodeURIComponent(
      `${startDate}T${startTime}:00+09:00`
    );

    console.log(
      `입력된 정보: ${userName}, ${startDate}, ${startTime} (변환전: ${startTimeInput})`
    );
    console.log(`계산된 startDateTime: ${startDateTime}`);

    // await askQuestion("\n실행하시겠습니까? 엔터키를 입력하면 바로 실행됩니다");

    await naverReserv(userName, startDate, startDateTime);
  } catch (e) {
    console.error("Main execution failed:", e);
    logger.log("FATAL", "Main execution failed", e);
  }
}

main();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
