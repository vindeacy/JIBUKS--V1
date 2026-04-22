import dotenv from 'dotenv';

dotenv.config();

const SMS_API_URL = 'https://isms.celcomafrica.com/api/services/sendsms/';
const SMS_API_KEY = process.env.SMS_API_KEY || 'b4e69853162316c2db235c8a444eb265';
const SMS_PARTNER_ID = process.env.SMS_PARTNER_ID || '36';
const SMS_SHORTCODE = process.env.SMS_SHORTCODE || 'TEXTME';

export const sendSMS = async ({ mobile, message }) => {
    try {
        const payload = {
            apikey: SMS_API_KEY,
            partnerID: SMS_PARTNER_ID,
            message: message,
            shortcode: SMS_SHORTCODE,
            mobile: mobile,
            pass_type: 'plain'
        };

        console.log('=== SMS Service Debug ===');
        console.log('API URL:', SMS_API_URL);
        console.log('API Key:', SMS_API_KEY ? 'Set (hidden)' : 'NOT SET');
        console.log('Partner ID:', SMS_PARTNER_ID);
        console.log('Shortcode:', SMS_SHORTCODE);
        console.log('Sending SMS to:', mobile);
        console.log('Message:', message);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(SMS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('Response Status:', response.status);
        console.log('Response OK:', response.ok);

        const data = await response.json();
        console.log('SMS API Full Response:', JSON.stringify(data, null, 2));

        // Check if the response indicates success
        if (data.responses && data.responses[0] && data.responses[0]['response-code'] === 200) {
            console.log(' SMS sent successfully. Message ID:', data.responses[0].messageid);
            return { success: true, messageId: data.responses[0].messageid };
        } else {
            const errorCode = data.responses?.[0]?.['response-code'] || 'unknown';
            const errorDesc = data.responses?.[0]?.['response-description'] || 'Unknown error';
            console.error(' SMS failed:', errorCode, '-', errorDesc);
            throw new Error(`SMS failed: ${errorCode} - ${errorDesc}`);
        }
    } catch (error) {
        console.error(' Error sending SMS:', error.message);
        console.error('Full error:', error);
        throw error;
    }
};

export const sendOtpSMS = async (mobile, otp) => {
    const message = `Your JIBUKS verification code is: ${otp}. This code expires in 15 minutes.`;
    return await sendSMS({ mobile, message });
};
