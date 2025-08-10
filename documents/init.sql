-- CodeWiki数据库初始化脚本
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS codewiki CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE codewiki;
CREATE TABLE `t_repo` (
                          `id` varchar(64) NOT NULL,
                          `name` varchar(128) NOT NULL,
                          `repo_type` int NOT NULL,
                          `path` varchar(512) DEFAULT NULL,
                          `target` varchar(1024) NOT NULL,
                          `token` varchar(512) DEFAULT NULL,
                          `description` varchar(512) DEFAULT NULL,
                          `language` bigint DEFAULT NULL,
                          `excludes` longtext,
                          PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
-- 显示创建结果
SHOW TABLES;
SELECT 'Database initialization completed successfully!' as status;
