let globalTimeZone = 'Asia/Kolkata'; // Default fallback

export const setGlobalTimeZone = (tz: string) => {
  if (tz) {
    try {
      // Validate timezone string
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      globalTimeZone = tz;
    } catch (e) {
      console.warn(`Invalid timezone string provided: ${tz}, falling back to ${globalTimeZone}`);
    }
  }
};

export const getGlobalTimeZone = () => globalTimeZone;

export const formatGlobalDate = (dateString: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
  try {
    if (!dateString) return '-';
    
    // Ensure the incoming DB string is parsed explicitly as UTC if it doesn't already have a Z
    // Because we configured DB with timezone: '+00:00' and dateStrings: true, the DB returns 'YYYY-MM-DD HH:mm:ss'
    let parseableString = dateString;
    if (typeof parseableString === 'string' && !parseableString.includes('Z') && !parseableString.includes('T')) {
      // It's a raw SQL string like "2023-10-15 12:00:00" coming from DB, treat it as UTC
      parseableString = parseableString.replace(' ', 'T') + 'Z';
    }
    
    const date = new Date(parseableString);
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: globalTimeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options
    }).format(date);
  } catch (err) {
    console.error('Timezone formatting error:', err);
    try {
      return new Date(dateString).toLocaleString(); // pure fallback
    } catch (e) {
      return String(dateString);
    }
  }
};

export const parseAdminInputDateToGlobalUTC = (datetimeLocalString: string) => {
  if (!datetimeLocalString) return '';
  try {
    const dateAsUTC = new Date(datetimeLocalString + 'Z');
    
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: 'UTC', hour12: false, 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    };
    
    const fmtUTC = new Intl.DateTimeFormat('en-US', options).format(dateAsUTC);
    const fmtTZ = new Intl.DateTimeFormat('en-US', { ...options, timeZone: globalTimeZone }).format(dateAsUTC);
    
    // Format is "MM/DD/YYYY, HH:mm:ss" -> replace non-date characters with space
    const cleanUTC = fmtUTC.replace(/[^0-9/:]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanTZ = fmtTZ.replace(/[^0-9/:]/g, ' ').replace(/\s+/g, ' ').trim();

    const msUTC = new Date(cleanUTC + ' UTC').getTime();
    const msTZ = new Date(cleanTZ + ' UTC').getTime();
    
    const offsetMs = msTZ - msUTC;
    const actualUTC = new Date(dateAsUTC.getTime() - offsetMs);
    
    return actualUTC.toISOString().slice(0, 19).replace('T', ' ');
  } catch (err) {
    const fallback = new Date(datetimeLocalString);
    return fallback.toISOString().slice(0, 19).replace('T', ' ');
  }
};
