import winston from 'winston';

export const getPaste = async (id: string, logger: winston.Logger): Promise<{ text: string }> => {
  logger.info(`Getting paste with id: ${id}`);
  throw new Error('Bad');
  return Promise.resolve({ text: 'paste text' });
};

export const putPaste = async (text: string, logger: winston.Logger): Promise<string> => {
  logger.info(`Created paste with id: TODO`);
  return Promise.resolve('paste text');
};
