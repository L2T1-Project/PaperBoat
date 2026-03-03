const UserModel = require('../models/userModel.js');

const jwt = require('jsonwebtoken');

class AuthenticateToken{
    constructor(){
        this.userModel = new UserModel();
    }

    authenticateToken = async(req, res, next) =>{
        try{
            console.log("authenticating users");

            if(process.env.BYPASS === 'true'){
                console.log("bypass mode enabled - skipping authentication");
                return next();
            }

            const authHeader = req.headers['authorization'] || req.headers['Authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if(!token){
                return res.status(401).json({
                    success: false,
                    message: 'Access token required'
                });
            }

            console.log("Verifying token");

            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

            req.auth = decoded;

            const userId = decoded.sub || decoded.id;
            const user = await this.userModel.getUserById(userId);

            if(!user){
                return res.status(401).json({
                    sucess: false,
                    message: 'User not found'
                });
            }

            req.user = user;
            if(req.user && !req.user.role && decoded && decoded.role){
                req.user.role = decoded.role;
            }
            next();
        } catch (error) {
            console.error('Token verification error:', error.message);
        
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token expired' 
                });
            }
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
    }
}

module.exposts = AuthenticateToken;