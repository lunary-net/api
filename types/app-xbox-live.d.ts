declare module 'app-xbox-live' {
  export class Account {
    constructor(token: string);
    people: {
      get: (uuid: string) => Promise<{
        people: Array<{
          xuid: string;
          displayName: string;
          gamertag: string;
          gamerScore: number;
          presenceState: string;
          presenceText: string;
        }>;
      }>;
    };
    club: {
      get: (clubId: string) => Promise<{
        clubs: Array<{
          id: string;
          tags: string[];
          preferredColor: string;
          membersCount: number;
          followersCount: number;
          reportCount: number;
          reportedItemsCount: number;
        }>;
      }>;
    };
  }
}
