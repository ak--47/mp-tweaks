// @ts-nocheck
const puppeteer = require("puppeteer");

const EXTENSION_PATH = "./";

let browser, EXTENSION_ID;

const timeout = 10_000; // 10 seconds timeout for each test

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


describe("general", () => {

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
	}, timeout);

});



describe("mod header", () => {
	let page;

	beforeEach(async () => {
		page = await browser.newPage();
		await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
		await page.waitForSelector('#loader', { hidden: true, timeout }); // Ensures loader is hidden before tests run
	});

	afterEach(async () => {
		await page.close();
	});

	test("add row", async () => {
		await page.waitForSelector("#addHeader", { timeout }); // Add this line to wait for the element to be loaded
		await page.click("#addHeader");
		const rowsCount = await page.$$eval(".row", (rows) => rows.length);
		expect(rowsCount).toBe(4); // Assuming starting with 3 rows
	}, timeout);

	test("remove row", async () => {
		await page.waitForSelector(".deletePair", { timeout }); // Add this line to wait for the element to be loaded
		await page.click(".deletePair"); // Click the delete button on the first row
		const rowsCount = await page.$$eval(".row", (rows) => rows.length);
		expect(rowsCount).toBe(2); // Assuming starting with 3 rows
	}, timeout);

	test("update value", async () => {
		const testValue = "i-am-a-test-value";
		await page.type(".headerValue", testValue);
		const currentHeaders = await page.evaluate(() => {
			return APP.getHeaders();
		});
		expect(currentHeaders[0]['x-imp']).toBe(testValue);

	}, timeout);

	test("update key", async () => {
		const testKey = "i-am-a-test-key";
		const testValue = "i-am-a-test-value";		
		await page.click('.headerKey', { clickCount: 3 });		
		await page.keyboard.press('Backspace');
		await page.type(".headerKey", testKey);

		await page.click('.headerValue', { clickCount: 3 });		
		await page.keyboard.press('Backspace');
		await page.type(".headerValue", testValue);
		const currentHeaders = await page.evaluate(() => {
			return APP.getHeaders();
		});
		expect(currentHeaders[0][testKey]).toBe(testValue);

	}, timeout);

	test("clear", async () => {
		await page.click("#clearHeaders");
		const rowsCount = await page.$$eval(".row", rows => rows.length);
		expect(rowsCount).toBe(3);
	}, timeout);
});



describe("session replay", () => {
    let page;

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
		await page.waitForSelector('#loader', { hidden: true, timeout });
        await page.waitForSelector('#sessionReplayToken', { visible: true });
    });

    afterEach(async () => {
        await page.close();
    });

    test("start replay", async () => {
        await page.type("#sessionReplayToken", "test-token");
        await page.click("#startReplay");
        const statusText = await page.evaluate(() => document.querySelector("#sessionReplayLabel").textContent);
        expect(statusText.includes("ENABLED")).toBe(true);
    }, timeout);

    test("stop replay", async () => {
        await page.click("#stopReplay");
        const statusText = await page.evaluate(() => document.querySelector("#sessionReplayLabel").textContent);
        expect(statusText.includes("DISABLED")).toBe(true);
    }, timeout);
});

describe("scripts", () => {
    let page;

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
		await page.waitForSelector('#loader', { hidden: true, timeout });
    });

    afterEach(async () => {
        await page.close();
    });

    test("toggles", async () => {
        const initialStatus = await page.evaluate(() => {
            const checkbox = document.querySelector("#hideBanners");
            checkbox.click();
            return checkbox.checked;
        });
        expect(initialStatus).toBe(true);
    }, timeout);
});


describe("feature flags", () => {
    let page;

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
		await page.waitForSelector('#loader', { hidden: true, timeout });        
    });

    afterEach(async () => {
        await page.close();
    });

    test("removes", async () => {
        await page.click("#removeAll");
		expect(true).toBe(true); //todo: what can we assert here?
    }, timeout);
});

describe("cookies", () => {
    let page;

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
		await page.waitForSelector('#loader', { hidden: true, timeout });
        await page.waitForSelector('#nukeCookies', { visible: true });
    });

    afterEach(async () => {
        await page.close();
    });

	test("nuke", async () => {
		await page.evaluate(() => {
			// Mock the alert to store its last message in a global variable
			window.lastAlertMsg = "none";
			window.alert = (msg) => window.lastAlertMsg = msg;
		});
		
		await page.click("#nukeCookies");
		
		// Retrieve the message from the mocked alert
		const alertText = await page.evaluate(() => window.lastAlertMsg);
		expect(alertText).toContain("Deleted ");
	}, timeout);
	
});

// describe("eztrack", () => {
//     let page;

//     beforeEach(async () => {
//         page = await browser.newPage();
//         await page.goto(`chrome-extension://${EXTENSION_ID}/src/app.html`);
// 		await page.waitForSelector('#loader', { hidden: true, timeout });
//         await page.waitForSelector('#startEZTrack', { visible: true });
		
//     });

//     afterEach(async () => {
//         await page.close();
//     });

//     test("starts", async () => {
//         await page.type("#EZTrackToken", "valid-token");
//         await page.click("#startEZTrack");
//         const statusText = await page.evaluate(() => document.querySelector("#EZTrackLabel").textContent);
//         expect(statusText.includes("ENABLED")).toBe(true);
//     }, timeout);

//     test("stops", async () => {
//         await page.click("#stopEZTrack");
//         const statusText = await page.evaluate(() => document.querySelector("#EZTrackLabel").textContent);
//         expect(statusText.includes("DISABLED")).toBe(true);
//     }, timeout);
// });