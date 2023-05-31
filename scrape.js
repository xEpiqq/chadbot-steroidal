import puppeteerExtra from "puppeteer-extra"
import stealthPlugin from "puppeteer-extra-plugin-stealth"
import chromium from "@sparticuz/chromium"
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from "./firebase.js"
import clipboard from 'clipboardy';

const url_id = "https://www.linkedin.com/groups/14048479/members/";
const groupId = url_id.match(/groups\/(\d+)\/members/)[1];

const access_tokens = [
  // "AQEDAULpMa0CX1tzAAABiGrGJooAAAGIjtKqik0AWU5PvN6OQT-BYafTokn8f8SSPOrfxC6Z4dS0YH_VtHIht5lBzHRUyGLQOFmhz5uPppatpd7GEtSKlJmyY9D56zXD84tvpKcTosddre40fDKbRw2v",
  "AQEDAS2vRC0FLffWAAABh7al9roAAAGH2rJ6ulYAIQ_YamljnqKsk1XW6KMqyQ2owvJ4lmmKaC3zzV8EgF6-Lsx55TeA9YzCuUn8WSVDRHIDNquMriDMh443yH5tPMzdvwl5-ePeqSQb4iISaiFR2N4w"
]

const message_quota_per_account = 250

function getMessage(name = "My friend") {
  return `${name}! found you on the web devs page. Seems like you're on the grind!!\n\nfigured I'd reach out personally. I just built an app that helps web devs get more clients.\n\nIt's in early access right now, so I'm only sending it to an exclusive group of legit developers.\n\nGive it a shot, 14 days free. Let me know what you think! scavng.com`
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
    executablePath: "/usr/bin/google-chrome",
    args: ["--start-maximized"]
  });

  const page = await browser.newPage()


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

  const chevronDown = await page.$('li-icon[type="chevron-down"]');
  await chevronDown.click();

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

    // // check if any windows are open at the beginning of loop and close them all
    // try {
    //   const closeIcon = await page.$$('.msg-convo-wrapper li-icon[type="close"]');
    //   for (let i = 0; i < closeIcon.length; i++) {
    //     await closeIcon[i].click();
    //   }

    // } catch (error) {
    //   console.log("error");
    // }

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
      const loadButton = await page.$(".scaffold-finite-scroll__load-button");
      if (loadButton) {
        await loadButton.click();
      }
      await page.waitForSelector(".ui-entity-action-row");
      continue;
    }

    let firstName, href, messagedArray;

    try {
      firstName = name.split(" ")[0];
      href = await row.$eval("a", (el) => el.getAttribute("href"));
      messagedArray = newestUserDoc.data().messaged;
      if (messagedArray.includes(href)) {
        console.log(`Skipping user with href: ${href}`);
        continue;
      }
    } catch (error) {
      console.log("error");
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
    await page.waitForTimeout(1000);


    // check if div with class msg-s-event__content exists
    const eventContent = await page.$(".msg-s-event__content");
    if (eventContent) {
      const closeIcon = await page.$('.msg-convo-wrapper li-icon[type="close"]');
      await closeIcon.click();
      await page.waitForTimeout(1000);
      continue;
    }

    const message = getMessage(firstName);
    clipboard.writeSync(message);

    await page.focus('.msg-form__contenteditable');
    await page.keyboard.down('Control');
    await page.keyboard.press('V');
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    await page.click(".msg-form__send-button");
    await page.waitForSelector(".msg-s-message-list");    
    // page.waitForSelector({ timeout: 2000 })
    await page.waitForTimeout(1000);

    // close the message window
    const closeIcon = await page.$('.msg-convo-wrapper li-icon[type="close"]');
    await closeIcon.click();
    await page.waitForTimeout(200);

    // scroll down a little bit
    await page.evaluate(() => {
      window.scrollBy(0, 50);
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
