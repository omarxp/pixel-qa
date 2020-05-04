require('dotenv').config()

let chai = require('chai')
let expect = require('chai').expect
let should = require('chai').should()
let chaiHttp = require('chai-http')
let puppeteer = require('puppeteer')

chai.use(chaiHttp)

let isHeadless = true
let browser, page, orderId, checkoutId, financialStatus, qrCodeUrl, thankPageUrl

// comment this line below to let test run without browser UI
isHeadless = false

before(async function() {
  this.timeout(10000);
  browser = await puppeteer.launch({
    headless: isHeadless
  })
  page = await browser.newPage()
  console.log(`Browser PID: ${browser._process.pid}`)
})

describe('Pay on Shopify w/ Midtrans', function(){
  // manual override test timeout. Beyond this limit, test is terminated.
  this.timeout(100000);

  it('gopay transaction, pending on shopify, pending on midtrans', async function() {
    // product detail
    await page.goto(process.env.PRODUCT_URL, { waitUntil: 'networkidle2' })

    // checkout
    await page.waitForSelector('[data-testid="Checkout-button"]')
    await page.click('[data-testid="Checkout-button"]')

    // add shippping address
    await page.waitForSelector('#checkout_email_or_phone')
    await page.type('#checkout_email_or_phone', 'pixelv2test@mailnesia.com', { delay: 50 })
    await page.type('#checkout_shipping_address_first_name', 'pixel')
    await page.type('#checkout_shipping_address_last_name', 'test')
    await page.type('#checkout_shipping_address_address1', 'fake address')
    await page.type('#checkout_shipping_address_city', 'Jakarta')
    await page.select('#checkout_shipping_address_country', 'Indonesia')
    await page.select('#checkout_shipping_address_province', 'JK')
    await page.type('#checkout_shipping_address_zip', '16000')
    await page.click('#continue_button')

    // add shipping method
    await page.waitForSelector('#continue_button')
    await page.click('#continue_button')

    // select payment gateway and redirect to snap
    await page.waitForSelector('#continue_button')
    await page.click('[data-select-gateway="' + process.env.GATEWAY_ID + '"]')
    await page.click('#continue_button')
    await page.waitForSelector('.button-main-content')
    await page.click('.button-main-content')

    // save orderId (shopify as checkout_id, midtrans as order_id) needed to call get status api
    await page.waitForSelector('span.text-amount-title')
    orderId = await page.evaluate(() =>
      document.querySelector('div.order-id-title.pull-right span.text-amount-title').textContent.trim()
    )

    // select gopay
    await page.waitForSelector('[href="#/qris"]')
    await page.click('[href="#/qris"]')
    
    // click pay now
    await page.waitForSelector('a.button-main-content.gopay-btn-alt.text-left')
    await page.click('a.button-main-content.gopay-btn-alt.text-left')

    // click already paid
    await page.waitFor(3000) // wait for gopay qr loaded
    qrCodeUrl = await page.evaluate(() =>
      document.querySelector("img.qr").getAttribute('src')
    );
    console.log(qrCodeUrl)
    await page.click('a.button-main-content')

    // redirect to shopify thank you page
    await page.waitForSelector('#checkout_id')
    checkoutId = await page.evaluate(() =>
      document.querySelector('#checkout_id').textContent.trim()
    )
    financialStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )

    thankPageUrl = page.url()
    console.log(thankPageUrl)

    expect(orderId).to.equal(checkoutId)
    expect(financialStatus).to.include('pending');

    chai.request(process.env.SANDBOX_URL)
      .get('/v2/' + orderId + '/status')
      .auth(process.env.SERVER_KEY, '')
      .end((err, res) => {
        console.log(res.body);
        expect(res.body.order_id).to.equal(orderId)
        expect(res.body.transaction_status).to.include('pending');
      });
  })

  it('gopay transaction, settlement on midtrans, paid on shopify', async function() {
    await page.goto(process.env.GOPAY_SIMULATOR_URL, { waitUntil: 'networkidle2' })

    // input qrcode
    await page.type('#qrCodeUrl', qrCodeUrl)
    await page.click('.btn.btn-primary')

    // pay
    await page.waitForSelector('.btn.btn-primary')
    await page.click('.btn.btn-primary')

    chai.request(process.env.SANDBOX_URL)
      .get('/v2/' + orderId + '/status')
      .auth(process.env.SERVER_KEY, '')
      .end((err, res) => {
        console.log(res.body);
        expect(res.body.order_id).to.equal(orderId)
        expect(res.body.transaction_status).to.include('settlement');
      });

    await page.goto(thankPageUrl, { waitUntil: 'networkidle2' })
    financialStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )
    expect(financialStatus).to.include('paid');
  })


  it('gopay transaction, cancel on midtrans, cancel on shopify', async function() {
    // product detail
    await page.goto(process.env.PRODUCT_URL, { waitUntil: 'networkidle2' })

    // checkout
    await page.waitForSelector('[data-testid="Checkout-button"]')
    await page.click('[data-testid="Checkout-button"]')

    // add shippping address
    await page.waitForSelector('#checkout_email_or_phone')
    await page.type('#checkout_email_or_phone', 'pixelv2test@mailnesia.com', { delay: 50 })
    await page.type('#checkout_shipping_address_first_name', 'pixel')
    await page.type('#checkout_shipping_address_last_name', 'test')
    await page.type('#checkout_shipping_address_address1', 'fake address')
    await page.type('#checkout_shipping_address_city', 'Jakarta')
    await page.select('#checkout_shipping_address_country', 'Indonesia')
    await page.select('#checkout_shipping_address_province', 'JK')
    await page.type('#checkout_shipping_address_zip', '16000')
    await page.click('#continue_button')

    // add shipping method
    await page.waitForSelector('#continue_button')
    await page.click('#continue_button')

    // select payment gateway and redirect to snap
    await page.waitForSelector('#continue_button')
    await page.click('[data-select-gateway="' + process.env.GATEWAY_ID + '"]')
    await page.click('#continue_button')
    await page.waitForSelector('.button-main-content')
    await page.click('.button-main-content')

    // save orderId (shopify as checkout_id, midtrans as order_id) needed to call get status api
    await page.waitForSelector('span.text-amount-title')
    orderId = await page.evaluate(() =>
      document.querySelector('div.order-id-title.pull-right span.text-amount-title').textContent.trim()
    )

    // select gopay
    await page.waitForSelector('[href="#/qris"]')
    await page.click('[href="#/qris"]')
    
    // click pay now
    await page.waitForSelector('a.button-main-content.gopay-btn-alt.text-left')
    await page.click('a.button-main-content.gopay-btn-alt.text-left')

    // click already paid
    await page.waitFor(3000) // wait for gopay qr loaded
    await page.click('a.button-main-content')

    // redirect to shopify thank you page
    await page.waitForSelector('#checkout_id')
    checkoutId = await page.evaluate(() =>
      document.querySelector('#checkout_id').textContent.trim()
    )
    financialStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )

    thankPageUrl = page.url()
    console.log(thankPageUrl)

    expect(orderId).to.equal(checkoutId)
    expect(financialStatus).to.include('pending');

    chai.request(process.env.SANDBOX_URL)
      .post('/v2/' + orderId + '/cancel')
      .auth(process.env.SERVER_KEY, '')
      .end((err, res) => {
        console.log(res.body);
        expect(res.body.order_id).to.equal(orderId)
        expect(res.body.transaction_status).to.include('cancel');
      });

    await page.waitFor(3000) // wait for midtrans push notif
    await page.goto(thankPageUrl, { waitUntil: 'networkidle2' })
    financialStatus = await page.evaluate(() =>
      document.querySelector('#order_cancelled').textContent.trim()
    )

    expect(financialStatus).to.include('true');
  })


  it('gopay transaction, expire on midtrans, cancel on shopify', async function() {
    // product detail
    await page.goto(process.env.PRODUCT_URL, { waitUntil: 'networkidle2' })

    // checkout
    await page.waitForSelector('[data-testid="Checkout-button"]')
    await page.click('[data-testid="Checkout-button"]')

    // add shippping address
    await page.waitForSelector('#checkout_email_or_phone')
    await page.type('#checkout_email_or_phone', 'pixelv2test@mailnesia.com', { delay: 50 })
    await page.type('#checkout_shipping_address_first_name', 'pixel')
    await page.type('#checkout_shipping_address_last_name', 'test')
    await page.type('#checkout_shipping_address_address1', 'fake address')
    await page.type('#checkout_shipping_address_city', 'Jakarta')
    await page.select('#checkout_shipping_address_country', 'Indonesia')
    await page.select('#checkout_shipping_address_province', 'JK')
    await page.type('#checkout_shipping_address_zip', '16000')
    await page.click('#continue_button')

    // add shipping method
    await page.waitForSelector('#continue_button')
    await page.click('#continue_button')

    // select payment gateway and redirect to snap
    await page.waitForSelector('#continue_button')
    await page.click('[data-select-gateway="' + process.env.GATEWAY_ID + '"]')
    await page.click('#continue_button')
    await page.waitForSelector('.button-main-content')
    await page.click('.button-main-content')

    // save orderId (shopify as checkout_id, midtrans as order_id) needed to call get status api
    await page.waitForSelector('span.text-amount-title')
    orderId = await page.evaluate(() =>
      document.querySelector('div.order-id-title.pull-right span.text-amount-title').textContent.trim()
    )

    // select gopay
    await page.waitForSelector('[href="#/qris"]')
    await page.click('[href="#/qris"]')
    
    // click pay now
    await page.waitForSelector('a.button-main-content.gopay-btn-alt.text-left')
    await page.click('a.button-main-content.gopay-btn-alt.text-left')

    // click already paid
    await page.waitFor(3000) // wait for gopay qr loaded
    await page.click('a.button-main-content')


    // redirect to shopify thank you page
    await page.waitForSelector('#checkout_id')
    checkoutId = await page.evaluate(() =>
      document.querySelector('#checkout_id').textContent.trim()
    )
    financialStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )

    thankPageUrl = page.url()
    console.log(thankPageUrl)

    expect(orderId).to.equal(checkoutId)
    expect(financialStatus).to.include('pending');

    chai.request(process.env.SANDBOX_URL)
      .post('/v2/' + orderId + '/expire')
      .auth(process.env.SERVER_KEY, '')
      .end((err, res) => {
        console.log(res.body);
        expect(res.body.order_id).to.equal(orderId)
        expect(res.body.transaction_status).to.include('expire');
      });

    await page.waitFor(3000) // wait for midtrans push notif
    await page.goto(thankPageUrl, { waitUntil: 'networkidle2' })
    financialStatus = await page.evaluate(() =>
      document.querySelector('#order_cancelled').textContent.trim()
    )

    expect(financialStatus).to.include('true');
  })

  it.only('gopay transaction, refund on midtrans, refund on shopify', async function() {
    // product detail
    await page.goto(process.env.PRODUCT_URL, { waitUntil: 'networkidle2' })

    // checkout
    await page.waitForSelector('[data-testid="Checkout-button"]')
    await page.click('[data-testid="Checkout-button"]')

    // add shippping address
    await page.waitForSelector('#checkout_email_or_phone')
    await page.type('#checkout_email_or_phone', 'pixelv2test@mailnesia.com', { delay: 50 })
    await page.type('#checkout_shipping_address_first_name', 'pixel')
    await page.type('#checkout_shipping_address_last_name', 'test')
    await page.type('#checkout_shipping_address_address1', 'fake address')
    await page.type('#checkout_shipping_address_city', 'Jakarta')
    await page.select('#checkout_shipping_address_country', 'Indonesia')
    await page.select('#checkout_shipping_address_province', 'JK')
    await page.type('#checkout_shipping_address_zip', '16000')
    await page.click('#continue_button')

    // add shipping method
    await page.waitForSelector('#continue_button')
    await page.click('#continue_button')

    // select payment gateway and redirect to snap
    await page.waitForSelector('#continue_button')
    await page.click('[data-select-gateway="' + process.env.GATEWAY_ID + '"]')
    await page.click('#continue_button')
    await page.waitForSelector('.button-main-content')
    await page.click('.button-main-content')

    // save orderId (shopify as checkout_id, midtrans as order_id) needed to call get status api
    await page.waitForSelector('span.text-amount-title')
    orderId = await page.evaluate(() =>
      document.querySelector('div.order-id-title.pull-right span.text-amount-title').textContent.trim()
    )

    // select gopay
    await page.waitForSelector('[href="#/qris"]')
    await page.click('[href="#/qris"]')
    
    // click pay now
    await page.waitForSelector('a.button-main-content.gopay-btn-alt.text-left')
    await page.click('a.button-main-content.gopay-btn-alt.text-left')

    // click already paid
    await page.waitFor(3000) // wait for gopay qr loaded
    qrCodeUrl = await page.evaluate(() =>
      document.querySelector("img.qr").getAttribute('src') // image selector
    );
    console.log(qrCodeUrl)
    await page.click('a.button-main-content')


    // redirect to shopify thank you page
    await page.waitForSelector('#checkout_id')
    checkoutId = await page.evaluate(() =>
      document.querySelector('#checkout_id').textContent.trim()
    )
    financialStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )

    thankPageUrl = page.url()
    console.log(thankPageUrl)

    expect(orderId).to.equal(checkoutId)
    expect(financialStatus).to.include('pending');

    await page.goto(process.env.GOPAY_SIMULATOR_URL, { waitUntil: 'networkidle2' })

    // input qrcode
    await page.type('#qrCodeUrl', qrCodeUrl)
    await page.click('.btn.btn-primary')

    // pay
    await page.waitForSelector('.btn.btn-primary')
    await page.click('.btn.btn-primary')
    await page.waitFor(1000)

    // approve
    chai.request('https://api.sandbox.midtrans.com')
      .post('/v2/' + orderId + '/refund')
      .auth(process.env.SERVER_KEY, '')
      .end((err, res) => {
        console.log(res.body);
        expect(res.body.order_id).to.equal(orderId)
        // expect(res.body.transaction_status).to.include('refund');
        console.log(res.body.transaction_status)
      });

    await page.waitFor(3000) // wait for midtrans push notif

    await page.goto(thankPageUrl, { waitUntil: 'networkidle2' })
    let refundStatus = await page.evaluate(() =>
      document.querySelector('#financial_status').textContent.trim()
    )

    expect(refundStatus).to.include('refunded');
  })

})

after(async function() {
  this.timeout(10000);
  // comment this line below to make browser stay open after test, for debugging purpose
  await browser.close()
})
