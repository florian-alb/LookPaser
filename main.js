const puppeteer = require("puppeteer");
const sqlite3 = require('sqlite3').verbose();


async function crawl() {
    let website;
    const prompt = require("prompt-sync")({ sigint: true });
    const looxID = prompt("Insert the loox id here: ");
    website = 'https://loox.io/s/' + looxID;
    console.log(`website to crawl ${website}`);

    const browser = await puppeteer.launch(
        {
            //headless: false, // open a visual page
            ignoreHTTPSErrors: true,
            timeout: 0,
        }
    );
    try {
        const page = await browser.newPage();
        await page.goto(website);
        await page.waitForSelector(".grid-container")
        console.log("Scrolling in process...")
        await infiniteScroll(page);
        const reviews = await page.$$(".grid-item");
        console.log("number of reviews:", reviews.length)

        let reviewsData = [];
        for (let review of reviews) {
            let reviewObj = {};
            const img = await review.$('.item-img img');
            reviewObj.img = await page.evaluate((el) => {
                return el === null ? null : el.src;
            }, img);

            const name = await review.$(".title")
            reviewObj.name = await page.evaluate(el => el.textContent.split('.')[0], name);
            const rating = await review.$(".stars")
            reviewObj.rating = await page.evaluate(el => el.getAttribute('aria-label').split(' ')[0], rating);
            const message = await review.$(".main-text")
            reviewObj.message = await page.evaluate(el => el.textContent, message);
            const product = await review.$(".name")
            reviewObj.product = await page.evaluate(el => el.textContent, product);
            reviewsData.push(reviewObj);

        }

        const db = new sqlite3.Database('reviews.db');
        initDb(db);

        // Insert each review into the SQLite database
        for (const review of reviewsData) {
            db.run(
                'INSERT INTO reviews (img, name, rating, message, product) VALUES (?, ?, ?, ?, ?)',
                [review.img, review.name, review.rating, review.message, review.product],
                function (err) {
                    if (err) {
                        console.error(err.message);
                    } else {
                        //console.log(`Review inserted with ID: ${this.lastID}`);
                    }
                }
            );
        }
        db.close();
    } catch (error) {
        console.log(error);
    } finally {
        await browser.close();
        console.log("Done")
    }
}

async function infiniteScroll(page) {
    let previousHeight = await page.evaluate('document.body.scrollHeight');
    let currentHeight;
    do {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(1000);
        currentHeight = await page.evaluate('document.body.scrollHeight');
    } while (currentHeight > previousHeight && (previousHeight = currentHeight));
}

async function getImgSrc(page) {
    await page.evaluate(() => {
        const imgElement = document.querySelector('.item-img img');
        if (imgElement) {
            console.log("img=",imgElement.getAttribute('src'))
            return imgElement.getAttribute('src');
        } else {
            return null
        }
    })
}

async function getName(review, page) {
    return page.evaluate(() => {
        return review.querySelector(".title").textContent;
    })
}

async function getRating(review, page) {
    return page.evaluate(() => {
        return review.querySelector('.stars').textContent.split(' ')[0];
    })
}

async function getMessage(review, page) {
    return page.evaluate(() => {
        return review.querySelector('.main-text').textContent;
    })
}

async function getProduct(review, page) {
    return page.evaluate(() => {
        return review.querySelector('.name .name-with-img').textContent;
    })
}

function initDb(db) {
    db.exec(`
            CREATE TABLE IF NOT EXISTS reviews
            (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                img TEXT,
                name TEXT,
                rating TEXT,
                message TEXT,
                product TEXT
            );
        `);
}

crawl()