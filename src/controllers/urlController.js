const validator = require('validator')
const shortURL = require('node-url-shortener')
const redis = require('redis')
const { promisify } = require("util");

const urlModel = require('../models/urlModel')


const isValid = function (value) {
    if (typeof value === "undefined" || typeof value === null) return false
    if (typeof value === "string" && value.trim().length == 0) return false
    return true
}

const isValidRequestBody = function (requestBody) {
    return Object.keys(requestBody).length > 0
}

//Connect to redis
const redisClient = redis.createClient(
    13190,
    "redis-13190.c301.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("gkiOIPkytPI3ADi14jHMSWkZEo2J5TDG", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});



//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);



const postUrlShorten = async function (req, res) {
    try {

        let requestBody = req.body
        if (!isValidRequestBody(requestBody)) return res.status(400).send({ status: false, msg: 'Invalid Input.Provide URL.' })

        let { urlCode, longUrl, shortUrl } = requestBody

        if (!isValid(longUrl)) return res.status(400).send({ status: false, msg: 'Enter longUrl' })
        if (!validator.isURL(longUrl)) return res.status(400).send({ status: false, msg: `${longUrl} is not a valid url.` })

        let alreadyExistingUrl = await urlModel.findOne({ longUrl: longUrl })
        if (alreadyExistingUrl) return res.status(400).send({ status: false, msg: `${longUrl} already exists.` })

        //logUrl:"https://www.npmjs.com/package/node-url-shortener"
        shortURL.short(longUrl, async function (err, url) {
            if (err) return res.status(400).send({ status: false, msg: 'Error in shortening of url' })
            if (url) {
                shortUrl = url // url:"https://cdpt.in/lv"
                urlCode = url.slice(url.lastIndexOf('/') + 1)//15+1

                let creationData = { urlCode, longUrl, shortUrl }
                let newSortUrl = await urlModel.create(creationData)
                res.status(201).send({ status: true, data: newSortUrl })
            }
        });

    }
    catch (error) {
        res.status(500).send({ status: false, msg: error.message })
    }
}


const getUrl = async function (req, res) {
    try {
        urlCode = req.params.urlCode
        let url = await GET_ASYNC(`${urlCode}`)
        
        if (url) {
             res.redirect(302, url)
        } else {
            let newURL = await urlModel.findOne({ urlCode: urlCode }).select({ longUrl: 1, _id: 0 })
            if (!newURL) return res.status(404).send({ status: false, msg: 'longUrl not found' })
            await SET_ASYNC(`${urlCode}`, JSON.stringify(newURL))
            res.redirect(302, newURL)
        }
    }
    catch (error) {
        res.status(500).send({ status: false, msg: error.message })
    }
}



module.exports = { postUrlShorten, getUrl }