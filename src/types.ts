export type ChromeStorage = {
	version: string;
	persistScripts: string[];
	serviceAcct: {
	  user: string;
	  pass: string;
	};
	whoami: {
	  name: string;
	  email: string;
	  orgId: string;
	  oauthToken: string;
	  orgName: string;
	};
	featureFlags: string[];
	sessionReplay: {
	  token: string;
	  enabled: boolean;
	};
	EZTrack: {
	  token: string;
	  enabled: boolean;
	};
	verbose: boolean;
	last_updated?: number;
  };
  


type Hacks = '100x' | 'hideBanners' | 'renameTabs'