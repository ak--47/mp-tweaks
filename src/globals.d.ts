// Chrome extension APIs are handled by @types/chrome

// Mixpanel data modification globals
declare var ALTERED_MIXPANEL_DATA: any;
declare var ALTERED_MIXPANEL_OVERRIDES: any;

// Mixpanel analytics SDK
declare var mixpanel: {
  init: (token: string, config?: any) => void;
  track: (event: string, properties?: any, callback?: Function) => void;
  identify: (userId: string) => void;
  people: {
    set: (properties: any) => void;
    set_once: (properties: any) => void;
    increment: (properties: any) => void;
  };
  register: (properties: any) => void;
  register_once: (properties: any) => void;
  reset: () => void;
  get_distinct_id: () => string;
  opt_out_tracking: () => void;
  opt_in_tracking: () => void;
  has_opted_out_tracking: () => boolean;
};

// Papa Parse - CSV parser
declare var Papa: {
  parse: (input: string | File, config?: any) => any;
  unparse: (data: any, config?: any) => string;
  SCRIPT_PATH?: string;
  LocalChunkSize?: number;
  RemoteChunkSize?: number;
  DefaultDelimiter?: string;
  BAD_DELIMITERS?: string[];
  RECORD_SEP?: string;
  UNIT_SEP?: string;
  WORKERS_SUPPORTED?: boolean;
};

// FileSaver.js
declare function saveAs(data: Blob | File, filename?: string, disableAutoBOM?: boolean): void;
declare var MIXPANEL_CATCH_FETCH_ACTIVE: boolean;
declare var CATCH_FETCH_INTENT: string;
declare var SESSION_REPLAY_ACTIVE: boolean;
declare var MIXPANEL_WAS_INJECTED: boolean;
// declare var APP: object;

// Chrome storage type helper for MP Tweaks
interface ChromeStorage {
  version?: string;
  persistScripts?: string[];
  serviceAcct?: any;
  whoami?: string;
  isEmployee?: boolean;
  disableSessRecording?: boolean;
  recorderMessages?: any[];
  sessionRecording?: any;
  recordingState?: string;
  recordingTimestamp?: number;
  recordingSessionId?: string;
  [key: string]: any;
}
