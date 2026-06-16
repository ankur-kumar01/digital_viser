async function up(conn) {
  const indianNames = [
    'Rahul_99', 'Priya_M', 'AmanK', 'Raj_007', 'NehaS', 'Vikas12', 'Simran_X', 'AmitB', 'Vijay_Pro', 'SoniaK',
    'Karan_Bet', 'Deepak_Flyer', 'Riya_Roy', 'Sachin_King', 'Arjun_999', 'Anjali_Fly', 'Rohan_Pro', 'Aditya_Aviator',
    'Sneha_Jet', 'Vikram_Risk', 'Pooja_Lucky', 'Nikhil_007', 'Akash_Win', 'Pooja_Singh', 'Suresh_M', 'Ramesh_G',
    'Gaurav_King', 'Manoj_Pro', 'Sunil_Rider', 'Kiran_K', 'Ajay_B', 'Alok_G', 'Anil_K', 'Ankur_M', 'Ansh_S',
    'Arnav_D', 'Aryan_V', 'Ayush_P', 'Chirag_R', 'Darshan_J', 'Dev_A', 'Dhruv_C', 'Gagan_N', 'Harsh_H', 'Hemant_Y',
    'Jai_R', 'Jatin_W', 'Kabir_Q', 'Kartik_Z', 'Kunal_L', 'Lakshay_T', 'Madhav_I', 'Manish_O', 'Mayank_E', 'Mohit_F',
    'Mukul_U', 'Naman_P', 'Navin_S', 'Nitin_D', 'Om_A', 'Parth_G', 'Pranav_H', 'Prashant_J', 'Prateek_K', 'Prem_L',
    'Puneet_M', 'Rajat_N', 'Rakesh_O', 'Ravi_P', 'Rishi_Q', 'Rithik_R', 'Ritik_S', 'Rohan_T', 'Sahil_U', 'Samir_V',
    'Sarthak_W', 'Saurabh_X', 'Shashank_Y', 'Shivam_Z', 'Shreyas_A', 'Siddharth_B', 'Sumit_C', 'Suraj_D', 'Tarun_E',
    'Tushar_F', 'Udit_G', 'Utkarsh_H', 'Vaibhav_I', 'Varun_J', 'Vedant_K', 'Vidyut_L', 'Viren_M', 'Vishal_N', 'Yash_O'
  ];

  const getRandomName = () => indianNames[Math.floor(Math.random() * indianNames.length)];

  const hinglishWaiting = [
    "bhai log, is baar flying high jayega 🚀", "next round pakka 3x paar!", "is baar toh 500 rs laga raha hu 💸", 
    "auto cashout 2.0x pe set kar diya", "chalo shuru karte hai!", "kya lagta hai dosto, is baar kitna jayega?", 
    "ready for takeoff! 🚀", "bhai log taiyaar ho jao badhiya profit ke liye!", "pichla round jaldi crash hua, ab lamba chalega", 
    "chalo sab log ready ho jao", "mere pass balance kam hai, is baar safe khelunga", "bhai koi trick batao winning ki?", 
    "sab all in mat karna dosto", "meri kismat aaj achi lag rahi hai", "aaj pura loss recover karna hai",
    "agle round me bada bet karunga", "bhai graph dekho, abhi high jayega", "kya lagta hai 10x paar karega aaj?",
    "network issue mat dena is baar", "mera target 5x hai bas", "koi VIP prediction hai kya?", "paisa double karne ka time aa gaya",
    "aaj raat tak 10k profit banana hai", "chalo bhai dekhte hai kismat kiska sath deti hai"
  ];
  const englishWaiting = [
    "let's go 5x this round", "putting 200 ₹ this time", "ready to fly", "hoping for a good multiplier", 
    "let's win big today guys", "who else is betting high?", "this graph looks promising", "let's hit that 10x!"
  ];

  const hinglishFlying = [
    "bhai hold karo hold karo! ✈️", "2x hogya, jaldi niklo sab!", "arre wah! 4x paar ho gaya 📈", 
    "bhai kaun kaun abhi tak hold kar raha hai?", "cashed out! safe khelna zaroori hai bhai", "ye plane toh rukne ka naam nahi le raha!", 
    "bhai ye toh 10x jayega lagta hai", "arre yaar, mai nikal gaya, abhi tak fly kar raha hai!", "o bhai sahab! kya run hai", 
    "chalo chalo profit book karo!", "kya baat hai, maza aa gaya!", "mera target 5x hai, ruko thoda", 
    "nikal lo sab log, crash hone wala hai", "ab rocket ban gaya plane!", "dil dhak dhak kar raha hai", 
    "bhai nikal lu kya?", "ruk jao abhi aur upar jayega", "mera 1000 profit dikh raha hai", "kash maine bada amount lagaya hota"
  ];
  const englishFlying = [
    "fly high baby, to the moon! 🚀", "cashout guys! 2x is good", "still holding!", "look at it go!", 
    "omg it's not stopping", "cashed out just in time", "going for 10x this time!"
  ];

  const hinglishCrashLow = [
    "kya yaar, ye toh shuru hote hi khatam ho gaya 😭", "dhoka ho gaya bhai!", "1.1x pe crash? bahut bekaar", 
    "kismat hi kharab hai aaj toh", "loot gaye sab ke sab!", "aree yaar, screen click hi nahi hui time pe", 
    "paise doob gaye is baar", "yeh kya mazaak hai bhaaya", "chota nuksan hogya, agle round me dekhnge", 
    "koi baat nahi, recovery karenge", "lag gaye yaar 😭", "mera sara profit chala gaya", "alg hi level ka dhoka tha ye",
    "1.00 pe kon crash karta hai bhai", "is se bura kya ho sakta hai", "ab bas safe khelna padega"
  ];
  const englishCrashLow = [
    "oof, terrible crash", "why so early??", "didn't even get a chance", "worst multiplier ever", 
    "lost my bet man", "unbelievable crash", "scam bro, 1.00x crash"
  ];

  const hinglishCrashMed = [
    "bach gaye, 2.2x pe cashout kiya 🎯", "ek second late ho gaya varna 3x milta!", "auto cashout ne bacha liya aaj", 
    "thik hai, agle round me cover karenge", "decent run tha, par aur hold kar sakta tha", "chalo profit toh hua kam se kam", 
    "3x pe nikala mai toh, badiya tha", "bhai thoda aur wait kar leta toh maza aata", "loss se toh bache kam se kam", 
    "dheere dheere balance badh raha hai", "nice run, sabne profit banaya na?", "mera 2.5x check karo!",
    "sahi time pe nikal gaya mai", "10 rs laga ke 30 kamaye 😂", "badiya round tha dosto"
  ];
  const englishCrashMed = [
    "phew, cashed out at 2.1x", "saved by auto cashout", "not bad, decent profit", "could have held longer", 
    "good run guys", "happy with my 3x win"
  ];

  const hinglishCrashHigh = [
    "baap re! 15x chala gaya 🚀", "kya khatarnak run tha bhai!", "kis kis ne bada payout uthaya?", 
    "maza aa gaya is round me!", "thoda aur hold karta toh nikal jati lottery 😂", "gazab run tha yaar, historical!", 
    "meri toh kismat chamak gayi aaj 💎", "bhai 10x pe auto cashout hit ho gaya!", "kya mast jack pot laga hai!", 
    "is baar sab ameer ban gaye", "chappar faad ke paisa mila!", "kash mai thoda aur rukta", 
    "sach me maza aa gaya, super hit run!", "aaj ki dawat meri taraf se", "are bhai 50x miss kar diya maine",
    "zindagi ban gayi is multiplier me"
  ];
  const englishCrashHigh = [
    "WOW! 15x is huge!!", "what an insane run 🚀", "biggest multiplier I've seen today", "jackpot guys!", 
    "absolutely crazy payout", "anyone hit 20x?"
  ];

  const states = ['WAITING', 'FLYING', 'CRASH_LOW', 'CRASH_MED', 'CRASH_HIGH'];

  function getRandomMessage(state) {
    const isEnglish = Math.random() < 0.10; // 10% English
    let list = [];
    if (state === 'WAITING') list = isEnglish ? englishWaiting : hinglishWaiting;
    if (state === 'FLYING') list = isEnglish ? englishFlying : hinglishFlying;
    if (state === 'CRASH_LOW') list = isEnglish ? englishCrashLow : hinglishCrashLow;
    if (state === 'CRASH_MED') list = isEnglish ? englishCrashMed : hinglishCrashMed;
    if (state === 'CRASH_HIGH') list = isEnglish ? englishCrashHigh : hinglishCrashHigh;
    
    return list[Math.floor(Math.random() * list.length)];
  }

  const values = [];
  for (let i = 0; i < 1000; i++) {
    const state = states[Math.floor(Math.random() * states.length)];
    const msg = getRandomMessage(state);
    const user = getRandomName();
    values.push([user, state, msg]);
  }

  // Insert in batches of 100 to avoid query size limits
  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    await conn.query('INSERT INTO simulated_aviator_chats (user_name, message_type, message_text) VALUES ?', [batch]);
  }
}

module.exports = { up };
