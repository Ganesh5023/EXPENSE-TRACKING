require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Firebase Admin setup
const { db } = require('./firebaseConfig');
const { autoCategorize, generateInsights } = require('./aiAnalyzer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key'
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

const JWT_SECRET = process.env.JWT_SECRET || 'super-smart-expense-secret-key';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Storage Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware: Authenticate JWT Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

// Register User
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const querySnapshot = await db.collection('users').where('email', '==', email).get();
        if (!querySnapshot.empty) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUserId = uuidv4();

        // Save to Firestore using Admin SDK
        await db.collection('users').doc(newUserId).set({
            id: newUserId,
            name,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const querySnapshot = await db.collection('users').where('email', '==', email).get();

        if (querySnapshot.empty) {
            return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'Account not found. Please create an account.' });
        }

        const userDoc = querySnapshot.docs[0];
        const user = userDoc.data();

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, user: { id: user.id, name: user.name, email: user.email, photoURL: user.photoURL, selfFeedback: user.selfFeedback, studentType: user.studentType } });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
    try {
        const { email, name, googleId, isLogin } = req.body;

        // Check if user exists by email
        const querySnapshot = await db.collection('users').where('email', '==', email).get();

        let user;
        if (querySnapshot.empty) {
            if (isLogin) {
                return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'Account not found. Please create an account.' });
            }
            // Create a new user if not exists
            const newUserId = uuidv4();
            user = {
                id: newUserId,
                name,
                email,
                password: '',
                googleId,
                createdAt: new Date().toISOString()
            };
            await db.collection('users').doc(newUserId).set(user);
        } else {
            if (!isLogin) {
                 return res.status(400).json({ error: 'USER_EXISTS', message: 'User with this email already exists. Please login.' });
            }
            // User exists
            user = querySnapshot.docs[0].data();
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, photoURL: user.photoURL, selfFeedback: user.selfFeedback, studentType: user.studentType } });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(500).json({ error: 'Google authentication failed' });
    }
});

// Update User Profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, photoURL, currency, phone, profession, dob, address, selfFeedback, studentType } = req.body;
        const userRef = db.collection('users').doc(req.user.userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedData = {
            name: name || userDoc.data().name,
            photoURL: photoURL !== undefined ? photoURL : userDoc.data().photoURL || '',
            currency: 'INR', // Force INR
            phone: phone || userDoc.data().phone || '',
            profession: profession || userDoc.data().profession || '',
            dob: dob || userDoc.data().dob || '',
            address: address || userDoc.data().address || '',
            selfFeedback: selfFeedback !== undefined ? selfFeedback : userDoc.data().selfFeedback || '',
            studentType: studentType !== undefined ? studentType : userDoc.data().studentType || 'Not a Student',
            updatedAt: new Date().toISOString()
        };

        await userRef.update(updatedData);

        // Get full updated user
        const finalDoc = await userRef.get();
        const fullUser = finalDoc.data();

        // Return user without password
        const { password, ...userWithoutPassword } = fullUser;
        res.json({ message: 'Profile updated successfully', user: userWithoutPassword });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Direct Photo Upload (New)
app.post('/api/user/upload-photo', authenticateToken, upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const photoURL = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const userRef = db.collection('users').doc(req.user.userId);

        await userRef.update({
            photoURL,
            updatedAt: new Date().toISOString()
        });

        const updatedDoc = await userRef.get();
        const { password, ...userWithoutPassword } = updatedDoc.data();

        res.json({
            message: 'Photo uploaded successfully',
            photoURL,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error("Upload Photo Error:", error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// AI Financial Advisor Chatbot
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message, history } = req.body;
        const userId = req.user.userId;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        const txSnapshot = await db.collection('transactions').where('userId', '==', userId).get();
        const transactionsList = txSnapshot.docs.map(doc => doc.data());

        // Calculate summary on the fly for the most accurate AI context
        const totalIncome = transactionsList.filter(t => t.type === 'income').reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
        const totalExpense = transactionsList.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
        const rawBalance1 = transactionsList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const totalBalance = Math.max(0, rawBalance1);

        let healthScore = 50;
        if (totalIncome > 0) {
            const savedRatio = (totalIncome - totalExpense) / totalIncome;
            healthScore = Math.min(100, Math.max(0, Math.round(50 + (savedRatio * 50))));
        }

        const summary = { totalBalance, totalIncome, totalExpense, healthScore };

        const context = `
            User: ${userData.name}
            Balance: ₹${summary.totalBalance}
            Income: ₹${summary.totalIncome}
            Expense: ₹${summary.totalExpense}
            Health Score: ${summary.healthScore}%
            Transactions: ${transactionsList.slice(0, 5).map(t => `${t.description}: ₹${t.amount}`).join(', ')}
        `;

        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_actual_gemini_api_key_here') {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `System: You are Expense Tracker AI Advisor. Uses context: ${context}. IMPORTANT: Only give the direct, exact answer to the user's question. Do not include extra conversational pleasantries (like "Hello" or "Sure") unless asked. Be concise.\n\nUser: ${message}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            res.json({ response: response.text() });
        } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy_key' && process.env.OPENAI_API_KEY !== 'your_actual_openai_api_key_here') {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are Expense Tracker AI Advisor. Uses context: ${context}. IMPORTANT: Only give the direct, exact answer to the user's question. Do not include extra conversational pleasantries (like "Hello" or "Sure") unless asked. Be concise.`
                    },
                    ...history,
                    { role: "user", content: message }
                ],
            });
            res.json({ response: completion.choices[0].message.content });
        } else {
            // --- SMART LOCAL RESPONDER (No API Key Fallback) ---
            const lowercaseMsg = message.toLowerCase();
            let response = "I'm your Expense Tracker local assistant. ";

            // 1. Check for specific categories
            const categories = ['food', 'travel', 'rent', 'entertainment', 'shopping', 'bills'];
            const mentionedCategory = categories.find(cat => lowercaseMsg.includes(cat));

            if (mentionedCategory) {
                const catExpenses = transactionsList.filter(t => t.category === mentionedCategory && t.type === 'expense');
                const total = catExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                response = `You've spent a total of ₹${total.toLocaleString()} on ${mentionedCategory} across ${catExpenses.length} transactions. `;
                if (total > 0) {
                    response += mentionedCategory === 'food' ? "Consider meal prepping to reduce this!" : "Keep an eye on these costs to stay within budget.";
                }
            }
            // 2. Check for balance queries
            else if (lowercaseMsg.includes('balance') || lowercaseMsg.includes('how much money')) {
                response = `Your current balance is ₹${summary.totalBalance.toLocaleString()}. You have ₹${summary.totalIncome.toLocaleString()} in total income and ₹${summary.totalExpense.toLocaleString()} in total expenses.`;
            }
            // 3. Check for income
            else if (lowercaseMsg.includes('income') || lowercaseMsg.includes('earned')) {
                response = `Your total income recorded is ₹${summary.totalIncome.toLocaleString()}. Most of this comes from your recent deposits.`;
            }
            // 4. Check for spending/expense
            else if (lowercaseMsg.includes('spend') || lowercaseMsg.includes('expense')) {
                response = `You have spent ₹${summary.totalExpense.toLocaleString()} in total. Your biggest spending category is ${transactionsList.filter(t => t.type === 'expense').length > 0 ? 'visible in your Analytics tab' : 'not yet determined'}.`;
            }
            // 5. Recent transaction query
            else if (lowercaseMsg.includes('recent') || lowercaseMsg.includes('last')) {
                if (transactionsList.length > 0) {
                    const last = transactionsList[0];
                    response = `Your most recent transaction was "${last.description}" for ₹${Math.abs(last.amount).toLocaleString()} on ${new Date(last.date).toLocaleDateString()}.`;
                } else {
                    response = "You don't have any transactions yet. Add one to start tracking!";
                }
            }
            // 6. Savings/Goals
            else if (lowercaseMsg.includes('save') || lowercaseMsg.includes('goal')) {
                response = `To save more, try reducing your "Wants" (currently ${100 - summary.healthScore}% of your profile logic). Check your Goals tab to track specific targets!`;
            }
            // 7. Utilization / Advice (New)
            else if (lowercaseMsg.includes('utilize') || lowercaseMsg.includes('suggest') || lowercaseMsg.includes('plan') || lowercaseMsg.includes('how to')) {
                const amountMatch = lowercaseMsg.match(/\d+/);
                const mentionedAmount = amountMatch ? parseInt(amountMatch[0]) : null;

                if (mentionedAmount) {
                    if (mentionedAmount < 200) {
                        response = `With ₹${mentionedAmount}, I'd suggest utilizing it for essential small needs like a quick healthy snack or a short commute. If you save it daily, that's ₹3,000 extra per month!`;
                    } else if (mentionedAmount < 1000) {
                        response = `₹${mentionedAmount} is a good amount for a 'Needs' refill—maybe groceries or a utility bill. To keep your health score at ${summary.healthScore}%, try to avoid using it on impulsive 'Wants'.`;
                    } else {
                        response = `For ₹${mentionedAmount}, you could consider putting a portion into your ${transactionsList.length > 0 ? 'Savings Goals' : 'future goal'}. It would significantly boost your runway!`;
                    }
                } else {
                    response = "To give you a better plan, tell me an amount you're looking to utilize! I can help you decide between 'Needs' and 'Wants' based on your current balance of ₹" + summary.totalBalance.toLocaleString() + ".";
                }
            }
            // Default Fallback
            else {
                response = `I'm analyzing your ₹${summary.totalBalance.toLocaleString()} balance. I can tell you about your spending in categories like food, travel, or rent, or help you plan how to utilize a specific amount. What's on your mind?`;
            }

            // Append API Key Tip
            response += "\n\n*(Tip: Add a free GEMINI_API_KEY to your backend/.env file for full Machine Learning conversational AI!)*";

            res.json({ response });
        }
    } catch (error) {
        console.error("AI Chat Error:", error);
        res.status(500).json({ error: 'AI advisor is currently busy. Try again soon!' });
    }
});

// --- MAIN ROUTES (PROTECTED) ---

// 1. Get all transactions for current user
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const querySnapshot = await db.collection('transactions').where('userId', '==', req.user.userId).get();

        const userTransactions = [];
        querySnapshot.forEach((doc) => {
            userTransactions.push({ _id: doc.id, ...doc.data() });
        });

        // Sort by date descending
        userTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(userTransactions);
    } catch (error) {
        console.error("Get Transactions Error:", error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// 2. Add a new transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { description, amount, type, category, isNeed, paymentMethod, date, notes } = req.body;

        const newTxData = {
            userId: req.user.userId,
            description,
            amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
            type,
            category,
            paymentMethod: paymentMethod || 'cash',
            isNeed: isNeed !== undefined ? isNeed : true,
            date: date || new Date().toISOString(),
            notes: notes || ''
        };

        const docRef = await db.collection('transactions').add(newTxData);

        res.status(201).json({ _id: docRef.id, ...newTxData });
    } catch (error) {
        console.error("Add Transaction Error:", error);
        res.status(400).json({ error: 'Failed to create transaction', details: error.message });
    }
});

// Update a transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const txId = req.params.id;
        const { description, amount, type, category, isNeed, paymentMethod, date, notes } = req.body;

        const txRef = db.collection('transactions').doc(txId);
        const txDoc = await txRef.get();

        if (!txDoc.exists || txDoc.data().userId !== req.user.userId) {
            return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }

        const updatedTxData = {
            description,
            amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
            type,
            category,
            paymentMethod: paymentMethod || 'cash',
            isNeed: isNeed !== undefined ? isNeed : true,
            date: date || txDoc.data().date,
            notes: notes || ''
        };

        await txRef.update(updatedTxData);
        res.json({ _id: txId, ...updatedTxData, userId: req.user.userId });
    } catch (error) {
        console.error("Update Transaction Error:", error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete a transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const txId = req.params.id;

        const txRef = db.collection('transactions').doc(txId);
        const txDoc = await txRef.get();

        if (!txDoc.exists || txDoc.data().userId !== req.user.userId) {
            return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }

        await txRef.delete();
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error("Delete Transaction Error:", error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// 3. Get summary dashboard stats
app.get('/api/summary', authenticateToken, async (req, res) => {
    try {
        const querySnapshot = await db.collection('transactions').where('userId', '==', req.user.userId).get();

        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push(doc.data());
        });

        const rawBalance2 = transactions.reduce((acc, curr) => acc + curr.amount, 0);
        const totalBalance = Math.max(0, rawBalance2);

        const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

        let healthScore = 50;
        if (income > 0) {
            const savedRatio = (income - expense) / income;
            healthScore = Math.min(100, Math.max(0, Math.round(50 + (savedRatio * 50))));
        } else if (expense === 0) {
            healthScore = 100;
        } else {
            healthScore = 20;
        }

        res.json({
            totalBalance,
            totalIncome: income,
            totalExpense: expense,
            healthScore
        });

    } catch (error) {
        console.error("Summary Error:", error);
        res.status(500).json({ error: 'Failed to calculate summary' });
    }
});

// 4. Get User Budgets
app.get('/api/budgets', authenticateToken, async (req, res) => {
    try {
        const querySnapshot = await db.collection('budgets').where('userId', '==', req.user.userId).get();

        if (querySnapshot.empty) {
            return res.json({});
        }

        const userBudgets = querySnapshot.docs[0].data().categories || {};
        res.json(userBudgets);
    } catch (error) {
        console.error("Get Budgets Error:", error);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

// 5. Update User Budgets
app.post('/api/budgets', authenticateToken, async (req, res) => {
    try {
        const { categories } = req.body;

        const querySnapshot = await db.collection('budgets').where('userId', '==', req.user.userId).get();

        if (querySnapshot.empty) {
            await db.collection('budgets').add({
                userId: req.user.userId,
                categories
            });
        } else {
            const budgetDoc = querySnapshot.docs[0];
            await db.collection('budgets').doc(budgetDoc.id).update({
                categories
            });
        }

        res.status(200).json({ message: 'Budgets updated successfully', categories });
    } catch (error) {
        console.error("Update Budgets Error:", error);
        res.status(400).json({ error: 'Failed to update budgets', details: error.message });
    }
});

// 6. Get User Goals
app.get('/api/goals', authenticateToken, async (req, res) => {
    try {
        const querySnapshot = await db.collection('goals').where('userId', '==', req.user.userId).get();

        const goals = [];
        querySnapshot.forEach((doc) => {
            goals.push({ _id: doc.id, ...doc.data() });
        });

        res.json(goals);
    } catch (error) {
        console.error("Get Goals Error:", error);
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
});

// 7. Add or Update a Goal
app.post('/api/goals', authenticateToken, async (req, res) => {
    try {
        const { id, title, targetAmount, savedAmount, deadline } = req.body;

        const goalData = {
            userId: req.user.userId,
            title,
            targetAmount: Number(targetAmount),
            savedAmount: Number(savedAmount || 0),
            deadline: deadline || null,
            updatedAt: new Date().toISOString()
        };

        let resultId;
        if (id) {
            await db.collection('goals').doc(id).update(goalData);
            resultId = id;
        } else {
            goalData.createdAt = new Date().toISOString();
            const docRef = await db.collection('goals').add(goalData);
            resultId = docRef.id;
        }

        res.status(200).json({ _id: resultId, ...goalData });
    } catch (error) {
        console.error("Save Goal Error:", error);
        res.status(400).json({ error: 'Failed to save goal', details: error.message });
    }
});

// 8. Delete a Goal
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const goalId = req.params.id;
        const goalRef = db.collection('goals').doc(goalId);
        const goalDoc = await goalRef.get();

        if (!goalDoc.exists || goalDoc.data().userId !== req.user.userId) {
            return res.status(404).json({ error: 'Goal not found or unauthorized' });
        }

        await goalRef.delete();
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error("Delete Goal Error:", error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// 9. AI Insights - Generate smart suggestions
app.get('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const txQuery = await db.collection('transactions').where('userId', '==', req.user.userId).get();
        const transactions = [];
        txQuery.forEach(doc => transactions.push(doc.data()));

        const budgetQuery = await db.collection('budgets').where('userId', '==', req.user.userId).get();
        const budgets = budgetQuery.empty ? {} : budgetQuery.docs[0].data().categories || {};

        const userQuery = await db.collection('users').doc(req.user.userId).get();
        const user = userQuery.data();

        const analysis = generateInsights(transactions, budgets, user);
        res.json(analysis);
    } catch (error) {
        console.error("AI Analysis Error:", error);
        res.status(500).json({ error: 'Failed to generate AI insights' });
    }
});

// 10. AI Categorize - Suggest category based on description
app.post('/api/ai/categorize', authenticateToken, (req, res) => {
    const { description, type } = req.body;
    const category = autoCategorize(description, type);
    res.json({ category });
});

// 11. Reflections - Save user self-reflections
app.post('/api/reflections', authenticateToken, async (req, res) => {
    try {
        const { category, note, date } = req.body;
        const reflection = {
            userId: req.user.userId,
            category,
            note: note || '',
            date: date || new Date().toISOString()
        };
        const docRef = await db.collection('reflections').add(reflection);
        res.status(201).json({ id: docRef.id, ...reflection });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save reflection' });
    }
});

app.get('/api/reflections', authenticateToken, async (req, res) => {
    try {
        const snapshot = await db.collection('reflections')
            .where('userId', '==', req.user.userId)
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        if (snapshot.empty) return res.json(null);
        res.json({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (error) {
        res.json(null);
    }
});

// 12. Account Management
app.delete('/api/user/data', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const deleteCollection = async (collectionName) => {
            const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
            if (snapshot.size === 0) return;
            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        };

        await deleteCollection('transactions');
        await deleteCollection('goals');
        await deleteCollection('budgets');
        await deleteCollection('reflections');

        res.json({ message: 'All user data deleted successfully. Account reset.' });
    } catch (error) {
        console.error("Delete User Data Error:", error);
        res.status(500).json({ error: 'Failed to delete user data' });
    }
});

app.delete('/api/user/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const deleteCollection = async (collectionName) => {
            const snapshot = await db.collection(collectionName).where('userId', '==', userId).get();
            if (snapshot.size === 0) return;
            const batch = db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        };

        await deleteCollection('transactions');
        await deleteCollection('goals');
        await deleteCollection('budgets');
        await deleteCollection('reflections');

        await db.collection('users').doc(userId).delete();

        res.json({ message: 'User account deleted successfully.' });
    } catch (error) {
        console.error("Delete Account Error:", error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
