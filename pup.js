const puppeteer = require('puppeteer'),
	deepmerge = require('deepmerge');

const defaults = {
	pdf: true, // if false then getPage will return a screenshot
	viewPort: {
		width: 1080,
		height: 1920,
	},
	media: 'screen',
	pdfOpts: {
		//format: 'A4',
		scale: 1,
		preferCSSPageSize: false,
		printBackground: true,
		width: 1080,
		height: 1920,
	},
	screenshotOpts: {
		fullPage: true,
	},
};

const badHeaders = /^(?:Accept|Pragma|X-Forwarded|Sec-Fetch|User-Agent|Content-|Accept-|Connection|Origin)/i;

const grab = async (opts, fn) => {
	if (!opts || !fn) throw new Error('must pass opts|url and a callback fn');

	let url = '';
	if (typeof opts === 'string') {
		url = opts;
		opts = { ...defaults };
	} else {
		url = opts.url;
		opts = deepmerge(defaults, opts || {});
	}

	if (!url || !url.startsWith('http')) return fn(null, `invalid url: ${url}`);

	const start = Date.now(),
		browser = await puppeteer.launch({
			defaultViewport: opts.viewPort,
			//headless: false,
			// executablePath: '/bin/google-chrome',
			args: ['--no-sandbox', '--disable-setuid-sandbox'] //, '--auto-open-devtools-for-tabs'],
		}),
		page = (await browser.pages())[0];

	try {
		await page.setDefaultNavigationTimeout(0);
		// await page.setViewport({ width, height });

		if (opts.headers) {
			await page.setRequestInterception(true);

			page.on('request', (req) => {
				const headers = req.headers();
				for (const k in opts.headers) {
					if (k.match(badHeaders)) {
						continue;
					}
					headers[k] = opts.headers[k].join('');
				}
				req.continue({ headers });
			});
		}

		await page.setBypassCSP(true);
		await page.setCacheEnabled(true);
		// await page.waitFor(1000);
		await page.goto(url, { waitUntil: 'networkidle0' });
		await page.emulateMedia(opts.media);
		// eslint-disable-next-line no-undef
		await page.evaluate(() => document.body.classList.add('puppy'));
		await waitForRendered(page);
		// await page.waitFor(50000);
		let buf = null;
		if (opts.pdf === true) {
			buf = await page.pdf(opts.pdfOpts);
		} else {
			buf = await page.screenshot(opts.screenshotOpts);
		}

		await fn(buf);
		console.log(`${JSON.stringify(opts)}, took: ${(Date.now() - start) / 1000}s.`);
	} catch (err) {
		await fn(null, err);
	} finally {
		await browser.close();
	}
};

module.exports = { defaults, grab };

const waitForRendered = async (page, timeout = 45000) => {
	const minStableIters = 3,
		checkDurationMsecs = 250;

	let checks = timeout / checkDurationMsecs + 1,
		lastSize = 0,
		stableIter = 0;

	while (checks--) {
		const html = await page.content(),
			curSize = html.length;

		stableIter = lastSize > 0 && curSize === lastSize ? stableIter + 1 : 0;

		if (stableIter >= minStableIters) break;

		lastSize = curSize;
		await page.waitFor(checkDurationMsecs);
	}
};
