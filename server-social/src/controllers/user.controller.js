"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const redis_1 = require("../modules/redis");
const user_1 = require("../schemas/user");
const constants_1 = require("../../../shared/constants/constants");
redis_1.client.subscribe('order-create');
exports.userController = {
    async create(params) {
        let userData = {
            email: params.email,
            username: params.username,
            password: params.password,
            passwordConf: params.passwordConf,
            profileImg: params.profileImg,
            description: params.description,
            country: params.country
        };
        if (!userData.email || !userData.username || !userData.password || !userData.passwordConf)
            throw 'Missing attributes';
        // use schema.create to insert data into the db
        const user = await user_1.User.create(userData);
        //
        // client.publish('user-created', JSON.stringify({
        // 	_id: user._id,
        // 	username: user.username
        // }), function(err) {
        // 	console.log('CALLBACK!!!!! CALLBACK!!!!! CALLBACK!!!!! CALLBACK!!!!!', arguments);
        // });
        return user;
    },
    getAllowedFields: ['_id', 'username', 'profileImg', 'country', 'followers', 'following', 'membershipStartDate', 'description'],
    async get(userId, type = constants_1.USER_FETCH_TYPE_SLIM, forceReload = false) {
        console.log('type!!!', type);
        let REDIS_KEY = 'user_' + userId;
        let fieldsArr = [];
        let user;
        switch (type) {
            case constants_1.USER_FETCH_TYPE_PROFILE_SETTINGS:
                return this.getProfileSettings(userId);
            case constants_1.USER_FETCH_TYPE_BROKER_DETAILS:
                fieldsArr = ['brokerToken', 'brokerAccountId'];
                break;
            case constants_1.USER_FETCH_TYPE_PROFILE:
                break;
            case constants_1.USER_FETCH_TYPE_SLIM:
            default:
                fieldsArr = ['_id', 'username', 'profileImg', 'country'];
                break;
        }
        if (type !== constants_1.USER_FETCH_TYPE_BROKER_DETAILS && !forceReload)
            user = await this.getCached(REDIS_KEY, fieldsArr);
        if (!user) {
            let fieldsObj = {};
            this.getAllowedFields.forEach(field => fieldsObj[field] = 1);
            user = (await user_1.User.aggregate([
                {
                    $match: {
                        _id: mongoose_1.Types.ObjectId(userId)
                    }
                },
                {
                    $project: {
                        followersCount: { $size: { '$ifNull': ['$followers', []] } },
                        followingCount: { $size: { '$ifNull': ['$following', []] } },
                        username: 1,
                        profileImg: 1,
                        country: 1,
                        brokerToken: 1,
                        brokerAccountId: 1,
                        description: 1
                    }
                },
                {
                    $limit: 1
                }
            ]))[0];
            user.profileImg = user_1.User.normalizeProfileImg(user.profileImg);
            redis_1.client.set(REDIS_KEY, JSON.stringify(user), function () {
                // Why wait?
            });
        }
        Object.keys(user)
            .filter(key => !fieldsArr.includes(key))
            .forEach(key => delete user[key]);
        return user;
    },
    async getProfileSettings(userId) {
        const user = await user_1.User.findById(userId, {
            username: 1,
            email: 1,
            profileImg: 1,
            country: 1,
            brokerToken: 1,
            brokerAccountId: 1,
            description: 1
        });
        user.profileImg = user_1.User.normalizeProfileImg(user.profileImg);
        return user;
    },
    async getCached(key, fields) {
        return new Promise((resolve, reject) => {
            redis_1.client.get(key, function (err, reply) {
                if (err)
                    reject(err);
                else
                    resolve(JSON.parse(reply));
            });
        });
    },
    async getMany(params, reqUserId) {
        const limit = params.limit || 20;
        const sort = params.sort || -1;
        // Filter allowed fields
        const fields = {};
        (params.fields || this.getAllowedFields).filter(field => this.getAllowedFields.includes(field)).forEach(field => fields[field] = 1);
        const usersQuery = user_1.User.aggregate([
            {
                $project: Object.assign({ followersCount: { $size: { '$ifNull': ['$followers', []] } }, followingCount: { $size: { '$ifNull': ['$following', []] } } }, fields)
            },
            {
                $limit: limit
            },
            {
                $sort: {
                    _id: sort
                }
            }
        ]);
        const data = await Promise.all([usersQuery, user_1.User.findById(reqUserId)]);
        const following = data[1].following;
        data[0].forEach(user => {
            user.profileImg = user_1.User.normalizeProfileImg(user.profileImg);
            user.follow = following.indexOf(user._id) > -1;
        });
        return data[0];
    },
    // TODO - Filter fields
    async update(id, params) {
        // Update DB
        const result = await user_1.User.update({ _id: mongoose_1.Types.ObjectId(id) }, params);
        if (result.nModified && result.ok) {
            return this.get(id, undefined, true);
        }
    },
    async remove(id) {
    }
};
//# sourceMappingURL=user.controller.js.map