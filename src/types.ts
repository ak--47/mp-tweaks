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
	  tabId: number;
	};
	EZTrack: {
	  token: string;
	  enabled: boolean;
	  tabId: number;
	};
	verbose: boolean;
	last_updated?: number;
	modHeaders: {
		headers: Object[]
		enabled: boolean;
	}
  };
  


type Hacks = '100x' | 'hideBanners' | 'renameTabs'