const pup = require('./pup'),
	express = require('express'),
	bodyParser = require('body-parser'),
	app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// @ts-ignore
const defaults = { ...pup.defaults };

app.get('/page', async (req, res) => {
	const { url, type } = req.query;
	if (typeof url !== 'string' || !url.startsWith('http')) return res.status(400).send(`invalid url: ${url}`);

	await pup.grab(
		{
			url,
			media: 'print',
			pdf: !type || type === 'pdf',
			png: type === 'png',
		},
		async (buf, err) => {
			if (err) return res.status(400).send(`error: ${'message' in err ? err.message : err}`);
			// @ts-ignore
			res.type(type || 'pdf');
			await res.send(buf);
		}
	);
});

app.post('/grab', async (req, res) => {
	const opts = { ...defaults, ...req.body };

	if (opts.png) delete opts.pdf;
	// @ts-ignore
	if (!opts.url || !opts.url.startsWith('http')) return res.status(400).send(`invalid url: ${opts.url}`);
	//console.log(`${req.ip}: ${JSON.stringify(opts)}`);

	await pup.grab(opts, async (buf, err) => {
		if (err) return res.status(400).send(`error: ${'message' in err ? err.message : err}`);
		res.type(opts.pdf ? 'pdf' : 'png');
		await res.send(buf);
	});
});

/* test with:
$ curl -X POST -H "Content-Type: application/json" -d '{"url":"https://www.whatismybrowser.com/detect/what-http-headers-is-my-browser-sending", "headers": {"X-Random-Header": "Hello"}}' http://localhost:8099/grab > /tmp/blah.pdf

$ curl -X POST -H "Content-Type: application/json" -d '{"url":"https://www.whatismybrowser.com/detect/what-http-headers-is-my-browser-sending", png: true, "headers": {"X-Random-Header": "Hello"}}' http://localhost:8099/grab > /tmp/blah.png
*/

const port = parseInt(process.env.PORT) || 8099;
app.listen(port, () => console.log(`Listening on port ${port}!`));
