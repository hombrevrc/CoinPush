import { parse } from 'url';
import * as semver from 'semver';

const path = require('path');
const express = require('express');
const httpProxy = require('http-proxy');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const config = require('../../tradejs.config');
const app = express();
const morgan = require('morgan');
const helmet = require('helmet');
const { json } = require('body-parser');

const PATH_WWW_ROOT = path.join(__dirname, '../../client/www');
const PATH_WWW_BROWSER_NOT_SUPPORTED_FILE = path.join(__dirname, '../public/index.legacy.browser.html');
const PATH_IMAGES = path.join(__dirname, '../../images');

/**
 * http
 */
const server = app.listen(config.server.gateway.port, () => console.info('Gateway listening on port : ' + config.server.gateway.port));

/**
 * proxy
 */
const proxy = global['proxyHandler'] = httpProxy.createProxyServer({});

// proxy.on('proxyReq', function (proxyReq, req, res, options) {
// 	if (req.body) {
// 		let bodyData = JSON.stringify(req.body);
// 		// in case if content-type is application/x-www-form-urlencoded -> we need to change to application/json
// 		// proxyReq.setHeader('Content-Type', 'application/json');
// 		// proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
// 		// stream the content
// 		// proxyReq.write(bodyData);
// 	}
// });

proxy.on('error', function (err, req, res) {
	console.error(err);
});

/**
 *
 * body parsing (json) - needs this middleware for form-multipart (file-upload) to work
 */
const isMultipartRequest = function (req) {
	let contentTypeHeader = req.headers['content-type'];
	return contentTypeHeader && contentTypeHeader.indexOf('multipart') > -1;
};

const bodyParserJsonMiddleware = function () {
	return function (req, res, next) {
		if (isMultipartRequest(req)) {
			return next();
		}
		return json()(req, res, next);
	};
};

app.use(bodyParserJsonMiddleware());

app.use(morgan('dev'));
app.use(helmet());

app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'App verion', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');
	next();
});

// TEMP TEMP TEMP, NOT REQUIRED WHEN USING ANDROID PLAYSTORE
// app.use((req, res, next) => {
// 	const appVersion = req.headers['app-version'];
// 	console.log(appVersion);

// 	if (!appVersion || !config.app.version)
// 		return next();

// 	if (semver.lt(appVersion, config.app.version))
// 		return res.status(424)

// 	next();
// });

// public assets
app.use(express.static(PATH_WWW_ROOT));

// images 
// TODO: should be on CDN
app.use(express.static(PATH_IMAGES));

// use JWT auth to secure the api, the token can be passed in the authorization header or query string
const getToken = function (req) {
	if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer')
		return req.headers.authorization.split(' ')[1];
};

app.use(expressJwt({ secret: config.token.secret, getToken }).unless((req) => {
	return (
		req.method === 'GET' || 
		req.originalUrl.startsWith('/api/v1/authenticate') || 
		(req.originalUrl === '/api/v1/user' && req.method === 'POST')
	);
}));


/**
 * websocket
 */
server.on('upgrade', (req, socket, head) => {
	switch (parse(req.url).pathname) {
		case '/ws/general/':
			proxy.ws(req, socket, head, { target: config.server.oldApi.apiUrl });
			break;
		case '/ws/candles/':
			proxy.ws(req, socket, head, { target: config.server.cache.apiUrl });
			break;
	}
});

/**
 * error - unauthorized
 */
app.use((err, req, res, next) => {
	console.log('ERRORO NAME: ', err.name);

	if (err.name === 'UnauthorizedError')
		return res.status(401).send('invalid token...');

	next();
});


/**
 * set client user id for upcoming (proxy) requests
 */
app.use((req, res, next) => {
	if (req.user) {
		req.headers._id = req.user.id;
		next();
	} else {
		const token = getToken(req);

		if (token) {
			jwt.verify(token, config.token.secret, {}, (err, decoded) => {
				if (err) {
					res.status(401);
				} else {
					req.user = decoded;
					next();
				}
			});
		} else {
			req.user = {};
			next();
		}
	}
});

// /**
//  * image
//  */
// app.get('/images/*', (req, res) => proxy.web(req, res, { target: config.server.fe.apiUrl }));

/**
 * image
 */

app.use('/api/v1/symbol', require('./api/symbol.api'));

/**
 * authenticate
 */
app.use('/api/v1/authenticate', require('./api/authenticate.api'));

/**
 * device
 */
app.use('/api/v1/device', require('./api/device.api'));

/**
 * notification
 */
app.use('/api/v1/notify', require('./api/notify.api'));

/**
 * upload
 */
app.use('/api/v1/upload', require('./api/upload.api'));

/**
 * user
 */
app.use('/api/v1/user', require('./api/user.api'));

/**
 * order
 */
app.use('/api/v1/order', require('./api/order.api'));

/**
 * comment
 */
app.use('/api/v1/comment', require('./api/comment.api'));
app.use('/api/v1/comment/*', require('./api/comment.api'));

/**
 * event
 */
app.use('/api/v1/event', require('./api/event.api'));

/**
 * search
 */
app.use('/api/v1/search', require('./api/search.api'));

/**
 * favorite
 */
app.use('/api/v1/favorite', require('./api/favorite.api'));

/**
 * error handling
 */
app.use((error, req, res, next) => {
	if (res.headersSent)
		return next(error);

	if (error && error.statusCode) {
		res.status(error.statusCode).send(error.error);

		if (error.message)
			console.error(error.message);

		return;
	}

	res.status(500).send({ error });
});