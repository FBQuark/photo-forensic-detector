import { Client, Account, Databases } from "appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

const account = new Account(client);
const databases = new Databases(client);

export async function getBackendJWT(): Promise<string> { //function to generate a JWT for the current user session, this will be sent to appwrite in order to validate users  when they 
                                                          //save results to the database 
  const res = await account.createJWT();
  return res.jwt;
}

export { client, account, databases };