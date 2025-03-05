import express from 'express';
import { Authflow, Titles } from 'prismarine-auth';
import { RealmAPI, BedrockRealmAPI } from 'prismarine-realms';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import axl from 'app-xbox-live';
import { ping } from 'bedrock-protocol';
import { port, databasePath } from './data/client/settings.json';
import protocolVersions from './data/client/protocol.json';

const app = express();

interface Realm {
  id: string;
  ip: string;
  port: number;
  remoteSubscriptionId?: string;
  ownerUUID: string;
  name: string;
  motd: string;
  defaultPermission: string;
  state: string;
  daysLeft: number;
  expired: boolean;
  expiredTrial: boolean;
  gracePeriod: boolean;
  worldType: string;
  maxPlayers: number;
  clubId: string;
  member: string[];
  invite: {
    code: string;
    ownerxuid: string;
    codeurl: string;
  };
  server: {
    motd: string;
    levelName: string;
    playersOnline: number;
    maxPlayers: number;
    gamemode: string;
    gamemodeId: number;
    version: string;
    protocol: number | string;
  };
  thumbnailId?: string;
  minigameName?: string;
  minigameId?: string;
  minigameImage?: string;
  owner: {
    xuid: string;
    displayName: string;
    gamertag: string;
    gamerScore: number;
    presenceState: string;
    presenceText: string;
  };
  club: {
    id: string;
    tags: string[];
    preferredColor: string;
    membersCount: number;
    followersCount: number;
    reportCount: number;
    reportedItemsCount: number;
  };
  request_id: string;
}

let realms: Realm[] = [];

// Load realms from a JSON file
const loadRealmsFromFile = (databasePath: string): void => {
  if (fs.existsSync(databasePath)) {
    const fileContent = fs.readFileSync(databasePath, 'utf8');
    realms = fileContent ? JSON.parse(fileContent) : [];
  } else {
    console.error(`File not found: ${databasePath}`);
  }
};

loadRealmsFromFile(databasePath);

app.get('/api/realms/', async (req, res) => {
  res.json({
    realmsapi: {
      documentation: {
        "GET /api/realms/": "Returns documentation for the API.",
        "GET /api/realms/:realmCode": "Fetches information for a specified realm using its realm code.",
      },
      endpoints: {
        "GET /api/realms/": "Provides a summary of available API documentation.",
        "GET /api/realms/:realmCode": "Retrieves detailed information about a specific realm identified by its realm code.",
      },
      schemas: {
        "Realm": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "ip": { "type": "string" },
            "port": { "type": "integer" },
            "remoteSubscriptionId": { "type": "string" },
            "ownerUUID": { "type": "string" },
            "name": { "type": "string" },
            "motd": { "type": "string" },
            "defaultPermission": { "type": "string" },
            "state": { "type": "string" },
            "daysLeft": { "type": "integer" },
            "expired": { "type": "boolean" },
            "expiredTrial": { "type": "boolean" },
            "gracePeriod": { "type": "boolean" },
            "worldType": { "type": "string" },
            "maxPlayers": { "type": "integer" },
            "clubId": { "type": "string" },
            "member": { "type": "array", "items": { "type": "string" } },
            "invite": {
              "type": "object",
              "properties": {
                "code": { "type": "string" },
                "ownerxuid": { "type": "string" },
                "codeurl": { "type": "string" }
              }
            },
            "server": {
              "type": "object",
              "properties": {
                "motd": { "type": "string" },
                "levelName": { "type": "string" },
                "playersOnline": { "type": "integer" },
                "maxPlayers": { "type": "integer" },
                "gamemode": { "type": "string" },
                "gamemodeId": { "type": "integer" },
                "version": { "type": "string" },
                "protocol": { "type": "integer" }
              }
            },
            "thumbnailId": { "type": "string", "default": null },
            "minigameName": { "type": "string", "default": null },
            "minigameId": { "type": "string", "default": null },
            "minigameImage": { "type": "string", "default": null },
            "owner": {
              "type": "object",
              "properties": {
                "xuid": { "type": "string" },
                "displayName": { "type": "string" },
                "gamertag": { "type": "string" },
                "gamerScore": { "type": "integer" },
                "presenceState": { "type": "string" },
                "presenceText": { "type": "string" }
              }
            },
            "club": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "tags": { "type": "array", "items": { "type": "string" } },
                "preferredColor": { "type": "string" },
                "membersCount": { "type": "integer" },
                "followersCount": { "type": "integer" },
                "reportCount": { "type": "integer" },
                "reportedItemsCount": { "type": "integer" }
              }
            },
          }
        }
      }
    }
  });
});

app.get('/api/realms/:realmCode', async (req, res) => {
  const realmCode = req.params.realmCode;
  const realmInfo = await getRealmInfo(realmCode);
  res.json(realmInfo);
});

async function getRealmInfo(realmCode: string): Promise<Realm | { name: boolean; realmCode: string; valid: boolean; error: string }> {
  const authflow = new Authflow(undefined, "./auth", { 
    flow: "live", 
    authTitle: Titles.MinecraftNintendoSwitch, 
    deviceType: "Nintendo"
  });
  const info = await authflow.getXboxToken(); 
  const api = RealmAPI.from(authflow, 'bedrock') as BedrockRealmAPI;

  try {
    const filePath = './data/client/database.json';
    let dumpedData = realms;

    if (realmCode.length === 8) {
      const realminfoid = {
        id: realmCode,
        name: realmCode,
      };
      return realminfoid as Realm;
    }
    const realm = await (api as any).getRealmFromInvite(realmCode);

    let host = '';
    let port = 19132;
    let server: {
      motd?: string;
      levelName?: string;
      playersOnline?: number;
      playersMax?: number;
      gamemode?: string;
      gamemodeId?: number;
      version?: string;
      protocol?: number;
      invalid?: boolean;
    } = { invalid: true };

    if (realm.state !== "CLOSED") { 
      const address = await realm.getAddress();
      host = address.host || '';
      port = address.port || 19132;
      server = await ping({ host, port });
    }
    
    // Map the protocol to the correct version
    let protocolVersion: number | string = server.protocol || 0;
    const protocolMapping = protocolVersions.find(pv => pv.version === server.protocol);
    if (protocolMapping) {
      protocolVersion = protocolMapping.minecraftVersion;
    }

    const xl = new axl.Account(`XBL3.0 x=${info.userHash};${info.XSTSToken}`);
    const owner = await xl.people.get(realm.ownerUUID);
    const club = await xl.club.get(realm.clubId);
    const clubInfo = club.clubs[0];
    const ownerInfo = owner.people[0] || {};

    const ownerDetails = {
      xuid: ownerInfo.xuid || '',
      displayName: ownerInfo.displayName || '',
      gamertag: ownerInfo.gamertag || '',
      gamerScore: typeof ownerInfo.gamerScore === 'string' ? parseInt(ownerInfo.gamerScore, 10) || 0 : ownerInfo.gamerScore || 0,
      presenceState: ownerInfo.presenceState || '',
      presenceText: ownerInfo.presenceText || ''
    };

    const clubDetail = {
      id: clubInfo.id,
      tags: clubInfo.tags,
      preferredColor: clubInfo.preferredColor,
      membersCount: clubInfo.membersCount,
      followersCount: clubInfo.followersCount,
      reportCount: clubInfo.reportCount,
      reportedItemsCount: clubInfo.reportedItemsCount
    };

    const realminfo: Realm = {
      id: realm.id,
      ip: host ?? '',
      port: port ?? 0,
      remoteSubscriptionId: realm.remoteSubscriptionId || null,
      ownerUUID: realm.ownerUUID,
      name: realm.name,
      motd: realm.motd,
      defaultPermission: realm.defaultPermission,
      state: realm.state,
      daysLeft: realm.daysLeft,
      expired: realm.expired,
      expiredTrial: realm.expiredTrial,
      gracePeriod: realm.gracePeriod,
      worldType: realm.worldType,
      maxPlayers: realm.maxPlayers,
      clubId: realm.clubId,
      member: realm.member,
      invite: {
        code: realmCode,
        ownerxuid: realm.ownerUUID,
        codeurl: "https://realms.gg/" + realmCode,
      },
      server: {
        motd: server.motd || '',
        levelName: server.levelName || '',
        playersOnline: server.playersOnline || 0,
        maxPlayers: server.playersMax || 0,
        gamemode: server.gamemode ?? "Unknown",
        gamemodeId: server.gamemodeId || 0,
        version: server.version || '',
        protocol: protocolVersion
      },
      thumbnailId: realm.thumbnailId || null,
      minigameName: realm.minigameName || null,
      minigameId: realm.minigameId || null,
      minigameImage: realm.minigameImage || null,
      owner: ownerDetails,
      club: clubDetail,
      request_id: uuidv4()
    };

    dumpedData.push(realminfo);
    await fs.writeFileSync(filePath, JSON.stringify(dumpedData, null, 2));

    return realminfo;
  } catch (error) {
    console.error("Realm not found", error);
    return { name: false, realmCode, valid: false, error: `${error}` };
  }
}

// Add interface for Xbox user data
interface XboxUser {
  people: Array<{
    xuid: string;
    displayName: string;
    gamertag: string;
    gamerScore: number;
    presenceState: string;
    presenceText: string;
  }>;
}

// Add dumped data interface and initialization
interface DumpedData {
  data: XboxUser[];
}

let dumped: DumpedData = { data: [] };

// Load Xbox users from file if it exists
try {
  if (fs.existsSync('data/client/xboxusers.json')) {
    const xboxData = fs.readFileSync('data/client/xboxusers.json', 'utf8');
    dumped = JSON.parse(xboxData);
  }
} catch (error) {
  console.error('Error loading Xbox users:', error);
}

app.get('/api/xbox/:xuid', async (req, res) => {
  try {
    const xuid = req.params.xuid;
    const authflow = new Authflow(undefined, "./auth", { 
      flow: "live", 
      authTitle: Titles.MinecraftNintendoSwitch, 
      deviceType: "Nintendo"
    });
    const info = await authflow.getXboxToken();
    const xl = new axl.Account(`XBL3.0 x=${info.userHash};${info.XSTSToken}`);
    const player = await xl.people.get(xuid);

    // Add request ID and timestamp
    const response = {
      ...player,
      request_id: uuidv4(),
      timestamp: new Date().toISOString()
    };

    res.json(response);

    // Save to dumped data
    dumped.data.push(player);
    await fs.writeFileSync('data/client/xboxusers.json', JSON.stringify(dumped.data, null, 2));
  } catch (error) {
    console.error('Error fetching Xbox user:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Xbox user data',
      request_id: uuidv4(),
      message: `${error}`
    });
  }
});

// Custom error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error_code: 500, message: "There was error on server-side (If you are admin check terminal to see)", request_id: uuidv4()});
});

// Handle 404 - Page Not Found
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error_code: 404, message: "Page Not Found", request_id: uuidv4()});
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});