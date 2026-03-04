declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_DEV_SERVER_URL?: string
      NODE_ENV?: 'development' | 'production'
    }
  }
}

module.exports = {}
