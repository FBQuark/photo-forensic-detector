import {Client, Account} from "react-native-appwrite";
import { Platform } from "react-native";


const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!);


switch(Platform.OS){
    case 'ios':
        client.setPlatform(process.env.EXPO_PUBLIC_APPWRITE_BUNDLE_ID!);
        break;
    case 'android':
        client.setPlatform(process.env.EXPO_PUBLIC_APPWRITE_PACKAGE_NAME!);
        break;
}

export async function getBackendJWT(): Promise<string> { //function to generate a JWT for the current user session, this will be sent to appwrite in order to validate users  when they 
                                                          //save results to the database 
  const res = await account.createJWT();
  return res.jwt;
}



const account = new Account(client);

export {account};