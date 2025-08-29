const functions = require("firebase-functions");
const { google } = require("googleapis");

// The ID of your Google Sheet
const SPREADSHEET_ID = '18kItbd7f9kErOfTfjBUjgjjPXW_Fbk_MHciOiJeQh0E';

const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: functions.config().google.service_account.client_email,
    private_key: functions.config().google.service_account.private_key.replace(/\\n/g, '\n')
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

exports.processPhotos = functions.https.onCall(async (data, context) => {
  const accessToken = data.accessToken;
  const userEmail = context.auth.token.email;
  
  if (!userEmail) {
    throw new functions.https.HttpsError('unauthenticated', 'User email not found.');
  }

  const photosAuth = new google.auth.OAuth2();
  photosAuth.setCredentials({ access_token: accessToken });

  const photosLibrary = google.photoslibrary({ version: 'v1', auth: photosAuth });
  const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

  let photoUrls = [];
  try {
    const response = await photosLibrary.mediaItems.search({
      pageSize: 10,
      filters: { mediaTypeFilter: { mediaTypes: ['PHOTO'] } },
    });
    
    const mediaItems = response.data.mediaItems;
    if (mediaItems) {
      photoUrls = mediaItems.map(item => [item.baseUrl, userEmail]);
    }
  } catch (error) {
    console.error('Error fetching photos:', error);
    return { success: false, message: 'Failed to fetch photos.' };
  }

  try {
    const range = 'Sheet1!A:B';
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      resource: {
        values: photoUrls,
      },
    });
    
    return { success: true, message: 'Photo links added successfully.' };
  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
    return { success: false, message: 'Failed to write to spreadsheet.' };
  }
});
