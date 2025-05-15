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
	featureFlags: Object[];
	demoLinks: Object[];
	sessionReplay: {
	  token: string;
	  enabled: boolean;
	  tabId: number;
	};
	verbose: boolean;
	last_updated?: number;
	modHeaders: {
		headers: ModHeaders[]
		enabled: boolean;
	}	
  };
  
// Define a type for the additional string key-value pairs
type AdditionalHeaders = {
    [key: string]: string;
}

// Define a type that includes the specific 'enabled' property and additional properties
type ModHeaders = AdditionalHeaders & {
    enabled: boolean;
}

type Hacks = '100x' | 'hideBanners' | 'renameTabs'