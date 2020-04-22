const puppeteer = require('puppeteer'),
	deepmerge = require('deepmerge');

const defaults = {
	pdf: true, // if false then getPage will return a screenshot
	viewPort: {
		width: 1920,
		height: 1080,
	},
	media: 'screen',
	pdfOpts: {
		format: 'A4',
		scale: 1,
		preferCSSPageSize: true,
		printBackground: true,
	},
	screenshotOpts: {
		fullPage: true,
	},
};

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
			defaultViewport: null,
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/tmp/puppy'],
		}),
		page = await browser.newPage();

	try {
		await page.setDefaultNavigationTimeout(0);
		await page.emulateMedia(opts.media);
		// await page.setViewport({ width, height });

		if (opts.headers) {
			await page.setRequestInterception(true);

			page.on('request', (req) => {
				const headers = req.headers();

				for (const k in opts.headers) headers[k] = opts.headers[k];

				req.continue({ headers });
			});
		}

		await page.setBypassCSP(true);
		await page.setCacheEnabled(true);
		await page.goto(url, { waitUntil: 'networkidle0' });
		// eslint-disable-next-line no-undef
		await page.evaluate(() => document.body.classList.add('puppy'));
		await waitForRendered(page);

		let buf = null;
		if (opts.pdf === true) {
			buf = await page.pdf(opts.pdfOpts);
		} else {
			buf = await page.screenshot(opts.screenshotOpts);
		}

		await fn(buf);
		console.log(`${JSON.stringify(opts)}, took: ${(Date.now() - start)/1000}s.`)
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

	let checks = (timeout / checkDurationMsecs) + 1,
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
