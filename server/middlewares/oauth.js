import OAuth  from "../lib/oauth.js";

export function OAuthFunction(req, res, next){
  const { tokens } = req.OAuthSession;
  if (!tokens) {
    return res.status(401).send();
  }

  console.log(req.OAuth2Client)
  req.OAuth2Client = OAuth.createClient(tokens);
  console.log(req.OAuth2Client)

  console.log("Tokens exist.")
  console.log(tokens)
  console.log(typeof(req.OAuth2Client.getRequestMetadataAsync()))

  return req.OAuth2Client.getRequestMetadataAsync(null, (error) => {
    req.OAuthSession.tokens = req.OAuth2Client.credentials;
    next(error);
  });
};

export default { OAuthFunction }
