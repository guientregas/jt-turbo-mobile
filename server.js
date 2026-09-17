try {
  if (fs.existsSync(DB)) {
    const old=JSON.parse(fs.readFileSync(DB,'utf8'));
    db={...db,...old};
    db.settings={...db.settings,...(old.settings||{})};
    db.settings.whatsapp={...{phoneNumber:'61995310137',phoneNumberId:'',graphVersion:'v23.0'},...(old.settings?.whatsapp||{})};
    db.settings.eta={...{enabled:true,arrivalRadiusM:150,minSpeedKmh:12,etaCooldownMin:10},...(old.settings?.eta||{})};
  }
} catch(e) { console.error('DB load',e.message); }
