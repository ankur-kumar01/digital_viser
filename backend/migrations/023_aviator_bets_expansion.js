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

  // Weighted bet amounts (more small bets, fewer big bets)
  const betAmounts = [
    10, 10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 100, 100, 200, 200, 500, 500, 1000, 2000, 5000
  ];
  
  const getRandomBet = () => betAmounts[Math.floor(Math.random() * betAmounts.length)];

  const values = [];
  for (let i = 0; i < 500; i++) {
    const user = getRandomName();
    const bet = getRandomBet();
    
    // Multipliers usually between 1.10 and 5.00, occasionally up to 25.00
    let multiplier;
    const r = Math.random();
    if (r < 0.6) multiplier = (Math.random() * (2.5 - 1.1) + 1.1).toFixed(2);
    else if (r < 0.9) multiplier = (Math.random() * (5.0 - 2.5) + 2.5).toFixed(2);
    else multiplier = (Math.random() * (25.0 - 5.0) + 5.0).toFixed(2);

    values.push([user, bet, parseFloat(multiplier)]);
  }

  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    await conn.query('INSERT INTO simulated_aviator_bets (user_name, bet_amount, target_multiplier) VALUES ?', [batch]);
  }
}

module.exports = { up };
