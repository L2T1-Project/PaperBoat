const DB_Connection = require('../database/db.js'); 

class createTables {
    constructor(){
        this.db_connection = DB_Connection.getInstance();
    }

    checkConnection = async () => {
        try {
            const query = `DROP TABLE BONKS`;

            const res = await this.db_connection.query_executor(query);
            console.log(res);
        } catch(err){
            console.log(err);
        }
    }
}

module.exports = createTables;