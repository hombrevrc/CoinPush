import { Router } from 'express';
import * as multer from 'multer';
import * as sharp from 'sharp';
import * as fs from 'fs';
import { join, extname } from 'path';
import { userController } from '../controllers/user.controller';
import { G_ERROR_MAX_SIZE } from '../../../shared/constants/constants';
const config = require('../../../tradejs.config');

const router = Router();

const IMAGE_DIR = join(__dirname, '..', '..', '..', 'images', 'images', 'profile');
const domainPrefix = 'http://' + (process.env.NODE_ENV === 'prod' ? config.ip.prod : config.ip.local) + ':' + config.port;

const upload = multer({ storage: multer.memoryStorage({}) });

function normalizeProfileImg(filename) {
	if (filename) {
		if (filename.indexOf('http://') > -1)
			return filename;

		return domainPrefix + join(config.image.profileBaseUrl, filename);
	}
	else
		return domainPrefix + config.image.profileDefaultUrl;
};

router.post('/profile', upload.single('image'), async (req: any, res, next) => {

	try {
		// Check max file size (in bytes)
		if (req.file.size > config.image.maxUploadSize)
			throw ({
				code: G_ERROR_MAX_SIZE,
				message: 'max file size is 10MB' // TODO hardcoded text
			});

		// Resize img
		sharp(req.file.buffer)
			.resize(1000)
			.max()
			.toBuffer(async (err, buffer) => {
				if (err) return next(err);

				const fileName = req.user.id + '_' + Date.now() + extname(req.file.originalname);
				const fullPath = join(IMAGE_DIR, fileName);

				fs.writeFile(fullPath, buffer, async (err) => {
					if (err) return next(err)

					const result = await userController.update(req.user, req.user.id, { img: fileName });

					res.send({ url: normalizeProfileImg(fileName) });

				});
			});

	} catch (error) {
		next(error);
	}
});

export = router;