async function up(conn) {
  // 1. Aviator Chats Table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS simulated_aviator_chats (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_name VARCHAR(255) NOT NULL,
      message_type ENUM('WAITING', 'FLYING', 'CRASH_LOW', 'CRASH_MED', 'CRASH_HIGH') NOT NULL,
      message_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Aviator Bets Table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS simulated_aviator_bets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_name VARCHAR(255) NOT NULL,
      bet_amount INT NOT NULL,
      target_multiplier DECIMAL(6,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Colour Trading Bets Table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS simulated_colour_trading_bets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_name VARCHAR(255) NOT NULL,
      bet_amount INT NOT NULL,
      color_choice VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Data
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM simulated_aviator_chats');
  if (rows[0].count === 0) {
    const indianNames = [
      'Rahul_99', 'Priya_M', 'AmanK', 'Raj_007', 'NehaS', 'Vikas12', 'Simran_X', 'AmitB', 'Vijay_Pro', 'SoniaK',
      'Karan_Bet', 'Deepak_Flyer', 'Riya_Roy', 'Sachin_King', 'Arjun_999', 'Anjali_Fly', 'Rohan_Pro', 'Aditya_Aviator',
      'Sneha_Jet', 'Vikram_Risk', 'Pooja_Lucky', 'Nikhil_007', 'Akash_Win', 'Pooja_Singh', 'Suresh_M', 'Ramesh_G',
      'Gaurav_King', 'Manoj_Pro', 'Sunil_Rider', 'Kiran_K'
    ];

    const getRandomName = () => indianNames[Math.floor(Math.random() * indianNames.length)];

    const seedChats = [
      // WAITING - 90% Hinglish, 10% English
      ['WAITING', "bhai log, is baar flying high jayega 🚀"],
      ['WAITING', "next round pakka 3x paar!"],
      ['WAITING', "is baar toh 500 rs laga raha hu 💸"],
      ['WAITING', "auto cashout 2.0x pe set kar diya"],
      ['WAITING', "chalo shuru karte hai!"],
      ['WAITING', "kya lagta hai dosto, is baar kitna jayega?"],
      ['WAITING', "ready for takeoff! 🚀"],
      ['WAITING', "bhai log taiyaar ho jao badhiya profit ke liye!"],
      ['WAITING', "pichla round jaldi crash hua, ab lamba chalega"],
      ['WAITING', "chalo sab log ready ho jao"],
      ['WAITING', "mere pass balance kam hai, is baar safe khelunga"],
      ['WAITING', "bhai koi trick batao winning ki?"],
      ['WAITING', "sab all in mat karna dosto"],
      ['WAITING', "let's go 5x this round"], // English
      ['WAITING', "putting 200 ₹ this time"], // English

      // FLYING
      ['FLYING', "bhai hold karo hold karo! ✈️"],
      ['FLYING', "2x hogya, jaldi niklo sab!"],
      ['FLYING', "arre wah! 4x paar ho gaya 📈"],
      ['FLYING', "bhai kaun kaun abhi tak hold kar raha hai?"],
      ['FLYING', "cashed out! safe khelna zaroori hai bhai"],
      ['FLYING', "ye plane toh rukne ka naam nahi le raha!"],
      ['FLYING', "bhai ye toh 10x jayega lagta hai"],
      ['FLYING', "arre yaar, mai nikal gaya, abhi tak fly kar raha hai!"],
      ['FLYING', "o bhai sahab! kya run hai"],
      ['FLYING', "chalo chalo profit book karo!"],
      ['FLYING', "kya baat hai, maza aa gaya!"],
      ['FLYING', "mera target 5x hai, ruko thoda"],
      ['FLYING', "nikal lo sab log, crash hone wala hai"],
      ['FLYING', "ab rocket ban gaya plane!"],
      ['FLYING', "fly high baby, to the moon! 🚀"], // English
      ['FLYING', "cashout guys! 2x is good"], // English

      // CRASH_LOW
      ['CRASH_LOW', "kya yaar, ye toh shuru hote hi khatam ho gaya 😭"],
      ['CRASH_LOW', "dhoka ho gaya bhai!"],
      ['CRASH_LOW', "1.1x pe crash? bahut bekaar"],
      ['CRASH_LOW', "kismat hi kharab hai aaj toh"],
      ['CRASH_LOW', "loot gaye sab ke sab!"],
      ['CRASH_LOW', "aree yaar, screen click hi nahi hui time pe"],
      ['CRASH_LOW', "paise doob gaye is baar"],
      ['CRASH_LOW', "yeh kya mazaak hai bhaaya"],
      ['CRASH_LOW', "chota nuksan hogya, agle round me dekhnge"],
      ['CRASH_LOW', "koi baat nahi, recovery karenge"],
      ['CRASH_LOW', "lag gaye lode 😭"],
      ['CRASH_LOW', "oof, terrible crash"], // English
      ['CRASH_LOW', "why so early??"], // English

      // CRASH_MED
      ['CRASH_MED', "bach gaye, 2.2x pe cashout kiya 🎯"],
      ['CRASH_MED', "ek second late ho gaya varna 3x milta!"],
      ['CRASH_MED', "auto cashout ne bacha liya aaj"],
      ['CRASH_MED', "thik hai, agle round me cover karenge"],
      ['CRASH_MED', "decent run tha, par aur hold kar sakta tha"],
      ['CRASH_MED', "chalo profit toh hua kam se kam"],
      ['CRASH_MED', "3x pe nikala mai toh, badiya tha"],
      ['CRASH_MED', "bhai thoda aur wait kar leta toh maza aata"],
      ['CRASH_MED', "loss se toh bache kam se kam"],
      ['CRASH_MED', "dheere dheere balance badh raha hai"],
      ['CRASH_MED', "nice run, sabne profit banaya na?"],
      ['CRASH_MED', "mera 2.5x check karo!"],
      ['CRASH_MED', "phew, cashed out at 2.1x"], // English
      ['CRASH_MED', "saved by auto cashout"], // English

      // CRASH_HIGH
      ['CRASH_HIGH', "baap re! 15x chala gaya 🚀"],
      ['CRASH_HIGH', "kya khatarnak run tha bhai!"],
      ['CRASH_HIGH', "kis kis ne bada payout uthaya?"],
      ['CRASH_HIGH', "maza aa gaya is round me!"],
      ['CRASH_HIGH', "thoda aur hold karta toh nikal jati lottery 😂"],
      ['CRASH_HIGH', "gazab run tha yaar, historical!"],
      ['CRASH_HIGH', "meri toh kismat chamak gayi aaj 💎"],
      ['CRASH_HIGH', "bhai 10x pe auto cashout hit ho gaya!"],
      ['CRASH_HIGH', "kya mast jack pot laga hai!"],
      ['CRASH_HIGH', "is baar sab ameer ban gaye"],
      ['CRASH_HIGH', "chappar faad ke paisa mila!"],
      ['CRASH_HIGH', "kash mai thoda aur rukta"],
      ['CRASH_HIGH', "sach me maza aa gaya, super hit run!"],
      ['CRASH_HIGH', "WOW! 15x is huge!!"], // English
      ['CRASH_HIGH', "what an insane run 🚀"] // English
    ];

    for (const chat of seedChats) {
      await conn.query(
        'INSERT INTO simulated_aviator_chats (user_name, message_type, message_text) VALUES (?, ?, ?)',
        [getRandomName(), chat[0], chat[1]]
      );
    }

    const aviatorBets = [
      [getRandomName(), 500, 2.50], [getRandomName(), 1000, 1.50], [getRandomName(), 200, 5.00],
      [getRandomName(), 50, 10.00], [getRandomName(), 2000, 1.20], [getRandomName(), 100, 3.00],
      [getRandomName(), 5000, 1.10], [getRandomName(), 300, 4.50], [getRandomName(), 150, 2.00],
      [getRandomName(), 400, 2.20], [getRandomName(), 800, 1.80], [getRandomName(), 600, 3.50],
      [getRandomName(), 10, 20.00], [getRandomName(), 20, 15.00], [getRandomName(), 100, 1.90]
    ];
    for (const bet of aviatorBets) {
      await conn.query(
        'INSERT INTO simulated_aviator_bets (user_name, bet_amount, target_multiplier) VALUES (?, ?, ?)',
        bet
      );
    }

    const colorChoices = ['green', 'red', 'violet', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const ctBets = [];
    for (let i = 0; i < 25; i++) {
      ctBets.push([
        getRandomName(),
        [10, 50, 100, 200, 500, 1000, 2000][Math.floor(Math.random() * 7)],
        colorChoices[Math.floor(Math.random() * colorChoices.length)]
      ]);
    }
    for (const bet of ctBets) {
      await conn.query(
        'INSERT INTO simulated_colour_trading_bets (user_name, bet_amount, color_choice) VALUES (?, ?, ?)',
        bet
      );
    }
  }
}

module.exports = { up };
