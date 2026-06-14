-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: digital_viser
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'Super Admin','admin@digitalviser.com','$2a$10$cY0PiRKU2HNZGdVk7jjGWugVaEmARTlSr/Sw8CGRO9L5lrzIIdJc2','2026-06-13 23:52:45');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deposits`
--

DROP TABLE IF EXISTS `deposits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `custom_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_id` (`transaction_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `deposits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deposits`
--

LOCK TABLES `deposits` WRITE;
/*!40000 ALTER TABLE `deposits` DISABLE KEYS */;
INSERT INTO `deposits` VALUES (1,1,5000.00,'upi','e795b85b-36e9-44ed-842b-fc90bdda0d77','success','2026-06-13 22:30:49',NULL),(2,1,40000.00,'Bank Transfer','aadf9e93-f3db-44c7-9c15-edff953110f9','rejected','2026-06-14 04:58:17','{}'),(3,1,10000.00,'Bank Transfer','b3f144e0-1def-4e20-9b4b-54956826c158','approved','2026-06-14 04:59:45','{\"Transaction Number\": \"56+4564654984\"}'),(4,1,4000.00,'Bank Transfer','9db5dbfd-93fe-444e-8767-660ceafd766f','rejected','2026-06-14 05:03:01','{\"Transaction Number\": \"454868489\"}');
/*!40000 ALTER TABLE `deposits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fdr_plans`
--

DROP TABLE IF EXISTS `fdr_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fdr_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `min_amount` decimal(15,2) NOT NULL,
  `max_amount` decimal(15,2) NOT NULL,
  `period_days` int NOT NULL,
  `interest_percent` decimal(5,2) NOT NULL,
  `duration_days` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fdr_plans`
--

LOCK TABLES `fdr_plans` WRITE;
/*!40000 ALTER TABLE `fdr_plans` DISABLE KEYS */;
INSERT INTO `fdr_plans` VALUES (1,'Monthly 30',1000.00,10000.00,1,1.00,30,1,'2026-06-14 04:08:14'),(2,'Fdr',100.00,1000.00,1,1.00,60,1,'2026-06-14 04:28:08');
/*!40000 ALTER TABLE `fdr_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fdrs`
--

DROP TABLE IF EXISTS `fdrs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fdrs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `interest_percent` decimal(5,2) NOT NULL,
  `period_days` int NOT NULL,
  `status` varchar(20) DEFAULT 'active',
  `accrued_interest` decimal(15,2) DEFAULT '0.00',
  `last_installment_date` date DEFAULT NULL,
  `next_installment_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fdrs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fdrs`
--

LOCK TABLES `fdrs` WRITE;
/*!40000 ALTER TABLE `fdrs` DISABLE KEYS */;
INSERT INTO `fdrs` VALUES (1,1,1000.00,'2026-07-28','2026-08-04',1.51,1,'completed',105.70,'2026-08-04','2026-08-05','2026-06-13 22:34:29'),(2,1,2000.00,'2026-09-07','2026-09-18',1.50,1,'active',0.00,'2026-09-07','2026-09-08','2026-06-14 04:06:30');
/*!40000 ALTER TABLE `fdrs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locked_funds`
--

DROP TABLE IF EXISTS `locked_funds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locked_funds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `wallet_type` varchar(50) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `linked_entity_id` int DEFAULT NULL,
  `linked_entity_type` varchar(50) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'locked',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `unlocked_at` timestamp NULL DEFAULT NULL,
  `unlock_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `locked_funds_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locked_funds`
--

LOCK TABLES `locked_funds` WRITE;
/*!40000 ALTER TABLE `locked_funds` DISABLE KEYS */;
/*!40000 ALTER TABLE `locked_funds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'001_initial_schema.js','2026-06-13 22:59:24'),(2,'002_add_withdrawals_table.js','2026-06-13 23:35:31'),(3,'003_admin_and_dynamic_config.js','2026-06-13 23:50:46'),(4,'004_seed_test_admin.js','2026-06-14 03:48:09'),(5,'005_payment_method_fields.js','2026-06-14 04:52:24'),(6,'006_user_profile_fields.js','2026-06-14 06:27:36'),(7,'007_multi_wallets.js','2026-06-14 06:27:36'),(8,'008_locked_funds_unlock_date.js','2026-06-14 06:49:34'),(9,'009_upi_config.js','2026-06-14 07:33:42');
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL COMMENT 'deposit or withdraw',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `admin_instructions` json DEFAULT NULL,
  `user_form` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES (1,'Bank Transfer','deposit',1,'2026-06-14 03:52:45','[{\"type\": \"text\", \"label\": \"Account Number\", \"value\": \"1131546416541654164141414\"}, {\"type\": \"text\", \"label\": \"Ifc Code\", \"value\": \"9844KJJHGJG\"}]','[{\"type\": \"text\", \"label\": \"Transaction Number\", \"required\": true}]'),(2,'Bank Transfer','withdraw',1,'2026-06-14 06:05:31','[]','[]'),(3,'Fast UPI Payment','deposit',1,'2026-06-14 07:41:02','[]','[]');
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reward_schemes`
--

DROP TABLE IF EXISTS `reward_schemes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_schemes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  `min_amount` decimal(15,2) DEFAULT '0.00',
  `reward_amount` decimal(15,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reward_schemes`
--

LOCK TABLES `reward_schemes` WRITE;
/*!40000 ALTER TABLE `reward_schemes` DISABLE KEYS */;
/*!40000 ALTER TABLE `reward_schemes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_state`
--

DROP TABLE IF EXISTS `system_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_state` (
  `key_name` varchar(50) NOT NULL,
  `value_data` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_state`
--

LOCK TABLES `system_state` WRITE;
/*!40000 ALTER TABLE `system_state` DISABLE KEYS */;
INSERT INTO `system_state` VALUES ('admin_upi_id','ankurkumar31782-5@okhdfcbank'),('simulated_date','2026-09-07');
/*!40000 ALTER TABLE `system_state` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(30) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,1,'deposit',5000.00,'Deposit via upi','2026-06-13 22:30:49'),(2,1,'fdr_lock',-1000.00,'FDR #1 locked','2026-06-13 22:34:29'),(3,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:42'),(4,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:42'),(5,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:42'),(6,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:46'),(7,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:58'),(8,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:58'),(9,1,'interest',15.10,'Interest from FDR #1','2026-06-13 23:38:58'),(10,1,'fdr_maturity',1000.00,'FDR #1 matured - principal returned','2026-06-13 23:38:58'),(11,1,'admin_adjustment_add',1000.00,'Admin adjustment (add)','2026-06-14 03:57:10'),(12,1,'fdr_lock',-2000.00,'FDR #2 locked','2026-06-14 04:06:30'),(13,1,'deposit_pending',40000.00,'Pending Deposit via Bank Transfer','2026-06-14 04:58:17'),(14,1,'deposit_pending',10000.00,'Pending Deposit via Bank Transfer','2026-06-14 04:59:45'),(15,1,'deposit_approved',10000.00,'Deposit Approved via Bank Transfer','2026-06-14 05:02:19'),(16,1,'deposit_pending',4000.00,'Pending Deposit via Bank Transfer','2026-06-14 05:03:01'),(17,1,'withdrawal_pending',100.00,'Pending Withdrawal via Bank Transfer','2026-06-14 06:05:57'),(18,1,'withdrawal_approved',100.00,'Withdrawal Approved via Bank Transfer','2026-06-14 06:06:26');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `balance` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `phone_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pin_code` varchar(20) DEFAULT NULL,
  `profile_photo` varchar(255) DEFAULT NULL,
  `bonus_balance` decimal(15,2) DEFAULT '0.00',
  `referral_balance` decimal(15,2) DEFAULT '0.00',
  `locked_balance` decimal(15,2) DEFAULT '0.00',
  `locked_bonus_balance` decimal(15,2) DEFAULT '0.00',
  `locked_referral_balance` decimal(15,2) DEFAULT '0.00',
  `referral_code` varchar(50) DEFAULT NULL,
  `invited_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `referral_code` (`referral_code`),
  KEY `invited_by` (`invited_by`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`invited_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'test','test@mail.com','$2a$10$m3d1W1v2zVAGOGDQvABIpeluqvN8zKwCFTWIK8SUuoIUMvSWhGjVy',14005.70,'2026-06-13 22:30:18',NULL,NULL,NULL,NULL,NULL,NULL,0.00,0.00,0.00,0.00,0.00,'REF19448',NULL),(2,'test2','test2@mail.com','$2a$10$t4vdfgyrn7fIf0CD1huRHeJwqWwSiPom/uIeJqyRmKGQn0MZGjedK',0.00,'2026-06-14 07:15:41',NULL,NULL,NULL,NULL,NULL,NULL,0.00,0.00,0.00,0.00,0.00,'REF341707204',NULL),(3,'test3','test3@mail.com','$2a$10$C5XGQm2nIN/ytNuRTUlGHeV7gKD7c6PSOmbJE14egbTBW9FSGa1cm',0.00,'2026-06-14 07:18:33','99999999','test','test','up','261403',NULL,0.00,0.00,0.00,0.00,0.00,'REF513577932',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `custom_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_id` (`transaction_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `withdrawals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdrawals`
--

LOCK TABLES `withdrawals` WRITE;
/*!40000 ALTER TABLE `withdrawals` DISABLE KEYS */;
INSERT INTO `withdrawals` VALUES (1,1,100.00,'Bank Transfer','bdbc4849-c8b4-4647-8d08-6d83b9fb7d99','approved','2026-06-14 06:05:57','{\"source_wallet\": \"normal\"}');
/*!40000 ALTER TABLE `withdrawals` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-14  8:48:11
