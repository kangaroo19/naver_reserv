// https://blog.naver.com/tact_1663/223340585668 녹화본있음

//2026-01-11
// 5시 57초에 실행했는데 6시 이전이라 안 열렸었음 그래서 바로 끄고 6시 3초에 들어갔는데도
// 성공적으로 예약됨
// 다음엔 58초에 실행해보기

const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const options = new chrome.Options();
options.addArguments("user-data-dir=C:\\user_data\\1000jjj"); // 브라우저를 최대화해서 실행
options.addEx;
// const BASIC_URL = "https://m.booking.naver.com/booking/13/bizes/987076/items/5336963"; // 실제로 사용할거
const BASIC_URL =
  "https://m.booking.naver.com/booking/6/bizes/551459/items/4033828"; // 테스트용

// START_DATE, START_DATE_TIEM 의 yyyy-mm-dd 값은 같아야함
const START_DATE = "2024-12-17";
const START_DATE_TIME = "2024-12-17T16%3A00%3A00%2B09%3A00";

async function naverReserv() {
  // WebDriver 초기화
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
  try {
    // 페이지 열기
    await driver.get(
      `${BASIC_URL}?area=bmp&lang=ko&map-search=1&service-target=map-pc&startDate=${START_DATE}&startDateTime=${START_DATE_TIME}&theme=place`
    );
    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)"
    );
    await sleep(300);
    // 로그인 화면 넘어가는 버튼
    const nextButton = await driver.wait(
      until.elementLocated(
        By.xpath('//*[@id="root"]/main/div[4]/div/button[2]')
      ),
      10000
    );

    // 클릭 가능한지 확인하고 클릭
    await driver.wait(until.elementIsVisible(nextButton), 10000);
    await nextButton.click();
  } catch (err) {
    console.error("에러 발생:", err);
  } finally {
    // 브라우저 닫기
    // await driver.quit();
  }
}

naverReserv();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
