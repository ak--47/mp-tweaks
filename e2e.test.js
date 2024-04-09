// @ts-nocheck
const puppeteer = require("puppeteer");

const EXTENSION_PATH = "./";

let browser, EXTENSION_ID;

beforeAll(async () => {
	browser = await puppeteer.launch({
		headless: false, // Extensions only load in headful mode
		args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
	});

	// New page to get extension ID
	const page = await browser.newPage();
	await page.goto("chrome://extensions");
	await page.waitForSelector("extensions-manager");

	// Extract extension ID from the page
	EXTENSION_ID = await page.evaluate(() => {
		const extension = document
			.querySelector("body > extensions-manager")
			.shadowRoot.querySelector("#items-list")
			.shadowRoot.querySelectorAll("extensions-item")?.[0];
		return extension.getAttribute("id");
	});

	await page.close();
});

afterAll(async () => {
	await browser.close();
});

test("popup renders", async () => {
	const page = await browser.newPage();
	await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
	const title = await page.title();
	const expectedTitle = "MP Tweaks!";
	const expectedHero = "MP Tweaks";
	const hero = await page.evaluate(() => {
		const h1 = document.querySelector("h1");
		return h1 ? h1.textContent : null;
	});
	expect(title).toBe(expectedTitle);
	expect(hero).toBe(expectedHero);
});


// let browser;

// beforeEach(async () => {
// 	browser = await puppeteer.launch({
// 	  headless: false,
// 	  args: [
// 		`--disable-extensions-except=${EXTENSION_PATH}`,
// 		`--load-extension=${EXTENSION_PATH}`
// 	  ]
// 	});
//   });

//   afterEach(async () => {
// 	await browser.close();
// 	browser = undefined;
//   });
