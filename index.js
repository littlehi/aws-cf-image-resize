'use strict';

const http = require('http');
const https = require('https');

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = 'littlehi-blog';

exports.handler = (event, context, callback) => {
  let response = event.Records[0].cf.response;

  console.log("Response status code :%s", response.status);

  //check if image is not present
  if (response.status == 403) {

    let request = event.Records[0].cf.request;

    // read the required path. Ex: uri /earth_200x200.jpg or /image/earth_200x200.jpg
    let path = request.uri;
    
    console.log("uri %s",path)

    // read the S3 key from the path variable.
    // Ex: path variable /earth.jpg
    let key = path.substring(1);
    console.log("key %s",key)
    
    let prefix, originalKey, match, width, height, requiredFormat, imageName;
    let startIndex;
    
    
    match = key.match(/(.*)_(\d+)x(\d+).(.*)/)
    
    originalKey = match[1]+"."+match[4]
    requiredFormat = match[4] =="jpg"?"jpeg":match[4]
    width = parseInt(match[2], 10);
    height = parseInt(match[3], 10);
    

    // get the source image file
    S3.getObject({ Bucket: BUCKET, Key: originalKey }).promise()
      // perform the resize operation
      .then(data => Sharp(data.Body)
        .resize(width, height)
        .toFormat(requiredFormat)
        .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            ContentType: 'image/' + requiredFormat,
            CacheControl: 'max-age=31536000',
            Key: key,
            StorageClass: 'STANDARD'
        }).promise()
        // even if there is exception in saving the object we send back the generated
        // image back to viewer below
        .catch(() => { console.log("Exception while writing resized image to bucket")});

        // generate a binary response with resized image
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/' + requiredFormat }];
        callback(null, response);
      })
    .catch( err => {
      console.log("Exception while reading source image :%j",err);
    });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response);
  }
};