import OAuth  from "../lib/oauth.js";

export async function OAuthFunction(req, res, next){
  const { tokens } = req.OAuthSession;
  if (!tokens) {
    console.log("No tokens found...")
    return res.status(401).send();
  }

  console.log("Tokens found")
  req.OAuth2Client = OAuth.createClient(tokens);

  let output = await req.OAuth2Client.getRequestMetadataAsync(null)

  if (!output) {
      req.OAuthSession.tokens = req.OAuth2Client.credentials;
      console.log(req.OAuthSession.tokens)
  }

  console.log(output)

  return output
};

export default { OAuthFunction }
