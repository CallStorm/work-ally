DROP TABLE IF EXISTS `bazaar_ratings`;
DROP TABLE IF EXISTS `bazaar_products`;
DROP TABLE IF EXISTS `bazaar_companies`;
DELETE FROM `app_registry` WHERE `slug` = 'bazaar';
