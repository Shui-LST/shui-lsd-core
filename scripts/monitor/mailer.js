"use strict";
// client id: 417565862058-nalivd9tboepi556oujtectqch3d87vu.apps.googleusercontent.com
// client secret: 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
const path = require('path');
const nodemailer = require('nodemailer');
const { google } = require('google-auth-library');

// Load client secrets from a file downloaded from the Google Cloud Console.
const credentials = require(path.join(__dirname, '../../tmp/google-credentials.json'));

// Create a transporter object with OAuth2 credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'stakerconflux@gmail.com',
    clientId: credentials.web.client_id,
    clientSecret: credentials.web.client_secret,
    refreshToken: credentials.web.refresh_token,
    accessToken: credentials.web.access_token,
  },
});

// Email content
const mailOptions = {
  from: 'stakerconflux@gmail.com',
  to: 'pan.wang@confluxnetwork.org',
  subject: 'Subject of the email',
  text: 'Body of the email',
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.error('Error:', error);
  }
  console.log('Email sent:', info.response);
});
