const router = require("express").Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { verifyToken } = require('../middleware/authMiddleware');

// update user
router.put('/:id', async (req, res) => {
    if (req.body.userId === req.params.id || req.body.isAdmin) {
        if (req.body.password) {
            try {
                const salt = await bcrypt.genSalt(10);
                req.body.password = await bcrypt.hash(req.body.password, salt);
            } catch (err) {
                return res.status(500).json(err);
            }
        }
        try {
            const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
            res.status(200).json(user);
        } catch (err) {
            return res.status(500).json(err);
        }
    } else {
        return res.status(403).json("You can update only your account!")
    }
});

// delete user
router.delete('/:id', async (req, res) => {
    if (req.body.userId === req.params.id || req.body.isAdmin) {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            res.status(200).json("Account has been deleted.")
        } catch (err) {
            return res.status(500).json(err);
        }
    } else {
        return res.status(403).json("You can delete only your account!")
    }
});

// get user and search user
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    const username = req.query.username;
    const search = req.query.search;
    try {
        if (userId || username) {
            const user = userId ? await User.findById(userId) : await User.findOne({ username: username });
            const { password, updatedAt, ...other } = user._doc;
            return res.status(200).json(other);
        }
        if (search) {
            const searchQuery = {
                $or: [
                    { username: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                ]
            }
            const users = await User.find(searchQuery).find({ _id: { $ne: req.user?._id } });
            return res.status(200).json(users);;
        }
        return res.status(400).json("No valid query parameters provided");
    } catch (err) {
        return res.status(500).json(err);
    }
});

// follow a user
router.put('/:id/follow',verifyToken , async (req, res) => {
    if (req.user.id !== req.params.id) {
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);
            if (!user.followers.includes(req.user.id)) {
                await user.updateOne({ $push: { followers: req.user.id } });
                await currentUser.updateOne({ $push: { followings: req.params.id } });
                res.status(200).json("user has been followed.");
            } else {
                res.status(403).json("you already follow this user.")
            }
        } catch (err) {
            return res.status(500).json(err);
        }
    } else {
        res.status(403).json("you can't follow yourself.")
    }
});

// un follow user
router.put('/:id/unfollow',verifyToken, async (req, res) => {
    if (req.user.id !== req.params.id) {
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);
            if (user.followers.includes(req.user.id)) {
                await user.updateOne({ $pull: { followers: req.user.id } });
                await currentUser.updateOne({ $pull: { followings: req.params.id } });
                res.status(200).json("user has been unfollowed.");
            } else {
                res.status(403).json("you don't follow this user.")
            }
        } catch (err) {
            return res.status(500).json(err);
        }
    } else {
        res.status(403).json("you can't unfollow yourself.")
    }
});

// get user friends
router.get('/friends/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const friends = await Promise.all(
            user.followings.map((friendId) => {
                return User.findById(friendId);
            })
        );
        let friendList = [];
        friends.map((friend) => {
            const { _id, username, profilePicture } = friend;
            friendList.push({ _id, username, profilePicture })
        })
        res.status(200).json(friendList)
    } catch (err) {
        return res.status(500).json(err);
    }
});



module.exports = router;

