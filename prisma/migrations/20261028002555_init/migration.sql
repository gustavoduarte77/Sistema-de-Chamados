-- CreateTable
CREATE TABLE `Pessoa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `tipo` ENUM('solicitante', 'tecnico') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Pessoa_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TipoProblema` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TipoProblema_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chamado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(100) NOT NULL,
    `descricao` TEXT NOT NULL,
    `prioridade` ENUM('baixa', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
    `situacao` ENUM('aberto', 'em_atendimento', 'resolvido', 'fechado', 'cancelado') NOT NULL DEFAULT 'aberto',
    `solicitanteId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NULL,
    `tipoProblemaId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvidoEm` DATETIME(3) NULL,

    INDEX `Chamado_situacao_idx`(`situacao`),
    INDEX `Chamado_prioridade_idx`(`prioridade`),
    INDEX `Chamado_tipoProblemaId_idx`(`tipoProblemaId`),
    INDEX `Chamado_tecnicoId_situacao_idx`(`tecnicoId`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Atribuicao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chamadoId` INTEGER NOT NULL,
    `tecnicoId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Atribuicao_tecnicoId_idx`(`tecnicoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comentario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chamadoId` INTEGER NOT NULL,
    `autorId` INTEGER NOT NULL,
    `texto` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comentario_chamadoId_idx`(`chamadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Chamado` ADD CONSTRAINT `Chamado_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `Pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chamado` ADD CONSTRAINT `Chamado_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `Pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chamado` ADD CONSTRAINT `Chamado_tipoProblemaId_fkey` FOREIGN KEY (`tipoProblemaId`) REFERENCES `TipoProblema`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Atribuicao` ADD CONSTRAINT `Atribuicao_chamadoId_fkey` FOREIGN KEY (`chamadoId`) REFERENCES `Chamado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Atribuicao` ADD CONSTRAINT `Atribuicao_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `Pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comentario` ADD CONSTRAINT `Comentario_chamadoId_fkey` FOREIGN KEY (`chamadoId`) REFERENCES `Chamado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comentario` ADD CONSTRAINT `Comentario_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `Pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
