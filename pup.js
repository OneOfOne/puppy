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
		preferCSSPageSize: true,
		format: 'letter',
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

	const browser = await puppeteer.launch({ defaultViewport: opts.viewPort }),
		page = await browser.newPage();

	try {
		if (opts.headers) {
			await page.setRequestInterception(true);

			page.on('request', (req) => {
				const headers = req.headers();

				for (const k in opts.headers) headers[k] = opts.headers[k];

				req.continue({ headers });
			});
		}

		await page.setBypassCSP(true);
		await page.goto(url, { waitUntil: 'networkidle2' });

		let buf = null;
		if (opts.pdf === true) {
			await page.emulateMedia(opts.media);
			buf = await page.pdf(opts.pdfOpts);
		} else {
			buf = await page.screenshot(opts.screenshotOpts);
		}

		await fn(buf);
	} catch (err) {
		await fn(null, err);
	} finally {
		await browser.close();
	}
};

module.exports = { defaults, grab };
