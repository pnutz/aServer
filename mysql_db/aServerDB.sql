SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

CREATE SCHEMA IF NOT EXISTS `aserver` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ;
USE `aserver` ;

-- -----------------------------------------------------
-- Table `aserver`.`ser_domain`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_domain` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `domain_name` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_url`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_url` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `url` VARCHAR(255) NOT NULL,
  `domain_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `domain_id_idx` (`domain_id` ASC),
  CONSTRAINT `fk_url_domain`
    FOREIGN KEY (`domain_id`)
    REFERENCES `aserver`.`ser_domain` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_receipt_attribute_group`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_receipt_attribute_group` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_name` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_receipt_attribute`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_receipt_attribute` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attribute_name` VARCHAR(45) NOT NULL,
  `data_type` VARCHAR(45) NOT NULL,
  `group_id` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `group_id_idx` (`group_id` ASC),
  CONSTRAINT `fk_receipt_attribute_group`
    FOREIGN KEY (`group_id`)
    REFERENCES `aserver`.`ser_receipt_attribute_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_html_tag`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_html_tag` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tag_name` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_element`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_element` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `template_id` INT NOT NULL,
  `element_id` INT NULL,
  `relation` ENUM('root','sibling','child','parent') NOT NULL,
  `level` INT NOT NULL,
  `tag_id` INT NOT NULL,
  `html` MEDIUMBLOB NOT NULL,
  `order` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_element_template_idx` (`template_id` ASC),
  INDEX `fk_element_tag_idx` (`tag_id` ASC),
  INDEX `fk_element_element_idx` (`element_id` ASC),
  CONSTRAINT `fk_element_template`
    FOREIGN KEY (`template_id`)
    REFERENCES `aserver`.`ser_template` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_element_tag`
    FOREIGN KEY (`tag_id`)
    REFERENCES `aserver`.`ser_html_tag` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_element_element`
    FOREIGN KEY (`element_id`)
    REFERENCES `aserver`.`ser_element` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_text`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_text` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `template_id` INT NOT NULL,
  `element_id` INT NULL,
  `text_id` INT NULL,
  `alignment` ENUM('root','left','right') NOT NULL,
  `text` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_text_idx` (`text_id` ASC),
  INDEX `fk_text_element_idx` (`element_id` ASC),
  INDEX `fk_text_template_idx` (`template_id` ASC),
  CONSTRAINT `fk_text`
    FOREIGN KEY (`text_id`)
    REFERENCES `aserver`.`ser_text` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_text_element`
    FOREIGN KEY (`element_id`)
    REFERENCES `aserver`.`ser_element` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_text_template`
    FOREIGN KEY (`template_id`)
    REFERENCES `aserver`.`ser_template` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_template`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_template` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attribute_id` INT NOT NULL,
  `url_id` INT NOT NULL,
  `text_id` INT NULL,
  `user_id` INT NOT NULL,
  `created_on` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `attribute_id_idx` (`attribute_id` ASC),
  INDEX `url_id_idx` (`url_id` ASC),
  INDEX `fk_template_text_idx` (`text_id` ASC),
  CONSTRAINT `fk_template_receipt_attribute`
    FOREIGN KEY (`attribute_id`)
    REFERENCES `aserver`.`ser_receipt_attribute` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_template_url`
    FOREIGN KEY (`url_id`)
    REFERENCES `aserver`.`ser_url` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_template_text`
    FOREIGN KEY (`text_id`)
    REFERENCES `aserver`.`ser_text` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_template_domain`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_template_domain` (
  `template_id` INT NOT NULL,
  `domain_id` INT NOT NULL,
  `probability_success` DECIMAL(5,3) NULL,
  `variance` DECIMAL(5,3) NULL,
  PRIMARY KEY (`template_id`, `domain_id`),
  INDEX `fk_domain_idx` (`domain_id` ASC),
  CONSTRAINT `fk_template`
    FOREIGN KEY (`template_id`)
    REFERENCES `aserver`.`ser_template` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_domain`
    FOREIGN KEY (`domain_id`)
    REFERENCES `aserver`.`ser_domain` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_element_attribute_type`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_element_attribute_type` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attribute_type` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_element_attribute_value`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_element_attribute_value` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attribute_value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_element_attribute`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_element_attribute` (
  `element_id` INT NOT NULL,
  `attribute_type_id` INT NOT NULL,
  `attribute_value_id` INT NOT NULL,
  PRIMARY KEY (`element_id`, `attribute_type_id`, `attribute_value_id`),
  INDEX `fk_attribute_type_idx` (`attribute_type_id` ASC),
  INDEX `fk_attribute_value_idx` (`attribute_value_id` ASC),
  CONSTRAINT `fk_element`
    FOREIGN KEY (`element_id`)
    REFERENCES `aserver`.`ser_element` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_attribute_type`
    FOREIGN KEY (`attribute_type_id`)
    REFERENCES `aserver`.`ser_element_attribute_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_attribute_value`
    FOREIGN KEY (`attribute_value_id`)
    REFERENCES `aserver`.`ser_element_attribute_value` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `aserver`.`ser_attempt`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `aserver`.`ser_attempt` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `template_id` INT NOT NULL,
  `url_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `success_flag` TINYINT(1) NOT NULL,
  `variance` DECIMAL(5,3) NULL,
  `created_on` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_attempt_template_idx` (`template_id` ASC),
  INDEX `fk_attempt_url_idx` (`url_id` ASC),
  CONSTRAINT `fk_attempt_template`
    FOREIGN KEY (`template_id`)
    REFERENCES `aserver`.`ser_template` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_attempt_url`
    FOREIGN KEY (`url_id`)
    REFERENCES `aserver`.`ser_url` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

CREATE USER 'db_admin' IDENTIFIED BY 'templeton';

GRANT ALL ON `aserver`.* TO 'db_admin';

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
