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

  const betAmounts = [10, 50, 100, 200, 500, 1000, 2000, 5000];
  const colorChoices = ['green', 'red', 'violet', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const values = [];
  for (let i = 0; i < 500; i++) {
    const user = getRandomName();
    const bet = betAmounts[Math.floor(Math.random() * betAmounts.length)];
    const choice = colorChoices[Math.floor(Math.random() * colorChoices.length)];

    values.push([user, bet, choice]);
  }

  for (let i = 0; i < values.length; i += 100) {
    const batch = values.slice(i, i + 100);
    await conn.query('INSERT INTO simulated_colour_trading_bets (user_name, bet_amount, color_choice) VALUES ?', [batch]);
  }
}

module.exports = { up };
