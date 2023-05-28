import puppeteerExtra from "puppeteer-extra"
import stealthPlugin from "puppeteer-extra-plugin-stealth"
import chromium from "@sparticuz/chromium"
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from "./firebase.js"

const url_id = "https://www.linkedin.com/groups/13948955/members/";
const groupId = url_id.match(/groups\/(\d+)\/members/)[1];

const access_tokens = [
  // "AQEDAULpMa0ALvqqAAABh7alYMoAAAGH2rHkylYAldlGfBtWkGMYn24yX7FzhrQFAY5WP09krrmcFlXaRRjZ_sgu04dp83c-CEzRvPQIQ_NgR2rq33WxDb__seqOKzlzmxsugDPD8v3IPPJZBqNAiESO",
  "AQEDAS2vRC0FLffWAAABh7al9roAAAGH2rJ6ulYAIQ_YamljnqKsk1XW6KMqyQ2owvJ4lmmKaC3zzV8EgF6-Lsx55TeA9YzCuUn8WSVDRHIDNquMriDMh443yH5tPMzdvwl5-ePeqSQb4iISaiFR2N4w"
]

const message_quota_per_account = 250

function getMessage(name = "My friend") {

  return `${name}, how you doing? Saw you on the web devs group, so I thought i'd reach out.\n\nJust launched an app that helps developers sell websites.\n\nIt changed the game for me, maybe you'd find it helpful too?\n\nLet me know what you think! The site is scavng.com`
}


async function linkedinScraper(access_token, message_quota_per_account) {
  // see if group id document already exists and if not create it
  const userRef = doc(db, "linkedin-sent-messages", groupId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    await setDoc(userRef, { messaged: ["genesislink"] });
  } else {
    console.log("doc exists");
  }
  // puppeteer launching logic
  
  puppeteerExtra.use(stealthPlugin())

  const browser = await puppeteerExtra.launch({
      headless: false,
      executablePath: "/usr/bin/google-chrome"
  })

  const page = await browser.newPage()
  await page.goto(url_id)
  await page.setViewport({ width: 950, height: 1000 });

  await page.setCookie({
    name: "li_at",
    value: access_token,
    domain: "www.linkedin.com",
    path: "/",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
  });

  // find the number of members in the group
  await page.goto(url_id, { waitUntil: "networkidle2" });
  await page.waitForSelector(".groups-members-list h1");
  const membersText = await page.$eval(
    ".groups-members-list h1",
    (el) => el.textContent
  );
  const membersCount = parseInt(membersText.replace(/\D/g, "")); // extract only digits and convert to integer

  let number_messaged = 0;
  for (let i = 0; i < membersCount; i++) {
    try {
    if (number_messaged >= message_quota_per_account) {
      break;
    }

    const newestUserDoc = await getDoc(userRef);
    const contactRows = await page.$$(".ui-entity-action-row");
    const row = contactRows[i];
    // check if it is time to load more of the page (name will fail if so)
    let name = "";
    try {
      name = await row.$eval(".artdeco-entity-lockup__title", (el) =>
        el.textContent.trim()
      );
    } catch {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForSelector(".ui-entity-action-row");
      continue;
    }

    const firstName = name.split(" ")[0];
    const href = await row.$eval("a", (el) => el.getAttribute("href"));
    const messagedArray = newestUserDoc.data().messaged;
    if (messagedArray.includes(href)) {
      console.log(`Skipping user with href: ${href}`);
      continue;
    }
    // try-catch just in case the user is you, you dont have a message button

    // if the number_messaged = 0
    console.log(`number messaged: ${number_messaged}`)
    if (number_messaged == 0) { 
        try {
          await page.waitForTimeout(4000);
          const button = await row.$(".artdeco-button");
          await button.click();
        } catch (error) {
            console.log("error");
            continue
        }
    }  else {
      try {
          const button = await row.$(".artdeco-button");
          await button.click();
      } catch (error) {
          console.log("error");
          continue;
      }
    } 

    await page.waitForSelector(".msg-form__contenteditable");
    await page.waitForTimeout(2000);

    const message = getMessage(firstName);
    // await page.type(".msg-form__contenteditable", "");

    await page.focus('.msg-form__contenteditable');
    await page.keyboard.type(message, { delay: 1 });

    await page.waitForTimeout(500);
    await page.click(".msg-form__send-button");
    await page.waitForSelector(".msg-s-message-list");
    await page.waitForTimeout(1000);

    // close the message window
    const closeIcon = await page.$('.msg-convo-wrapper li-icon[type="close"]');
    await closeIcon.click();
    await page.waitForTimeout(1000);

    // scroll down a little bit
    await page.evaluate(() => {
      window.scrollBy(0, 100);
    });

    const newHrefs = [...newestUserDoc.data().messaged, href];
    await setDoc(userRef, { messaged: newHrefs });

    number_messaged += 1;

    console.log(i);


  } catch {
    console.log("error");
    continue;
  }
  }

  await browser.close();
}

async function scraperLauncher() {
    for (let i = 0; i < access_tokens.length; i++) {
        await linkedinScraper(access_tokens[i], message_quota_per_account);
    }
}

scraperLauncher();



// const browser = await puppeteerExtra.launch({
//   args: chromium.args,
//   defaultViewport: chromium.defaultViewport,
//   executablePath: await chromium.executablePath(),
//   ignoreHTTPSErrors: true,
//   headless: chromium.headless,
// })
