var { nanoid } = require('nanoid')
const User = require('../models/User')
const Organisation = require('../models/Organisation')
const jwt = require('jsonwebtoken')
const expressJwt = require('express-jwt')
const { hashPassword, comparePassword } = require('../helpers/auth')
const { transporter } = require('../helpers/nodeMail')
require('dotenv').config()
const ejs = require('ejs')
const path = require('path')

// const nanoid = require('nanoid')

const handleErrors = (err) => {
  let error = {
    name: '',
    email: '',
    telephone: '',
    dob: '',
    password: '',
    admin: '',
    acc: '',
  }

  // incorrect email
  if (err.message === 'incorrect email') {
    error.email = 'Email is not registered'
    return error
  }
  if (err.message === 'incorrect password') {
    error.password = 'incorrect password'
    return error
  }

  if (err.message === 'Account not Verified') {
    error.acc = 'Account not Verified'
    return error
  }

  if (err.code === 11000) {
    error.email = 'this email is taken'
    return error
  }

  if (err.message.includes('User validation failed')) {
    Object.values(err.errors).forEach(({ properties }) => {
      error[properties.path] = properties.message
    })
  }
  return error
}

//nodemailer options
const options = {
  from: process.env.Nodemailer_email,
  to: 'mezleme3@gmail.com',
  subject: 'sending email from sendmail',
}

const userById = (req, res, next, id) => {
  User.findById(id).exec((err, user) => {
    if (err || !user) {
      // console.log(err, id)
      return res.status(400).json({ error: 'User not found' })
    }
    req.profile = user
    next()
  })
}

const maxAge = 60 * 4320
const createToken = (id) => {
  return jwt.sign({ id }, process.env.jt, {
    expiresIn: '2h',
  })
}

const create_User = (req, res, next) => {
  const user = new User(req.body)
  user.save((err, data) => {
    if (err) {
      const errors = handleErrors(err)
      res.json({ err: errors })
    } else {
      req.profile = data
      next()
    }
  })
}

const get_User = async (req, res) => {
  // a user logsin to an organisational portal
  const { email, password } = req.body
  // console.log('user ', email, ' attempting to login')

  try {
    const user = await User.login(email, password)
    const token = createToken(user._id)
    res.cookie('jwt', token, {
      httpOnly: true,
      maxAge: maxAge * 1000,
      // sameSite: 'None',
    })
    if (user) {
      Organisation.find({ user: user._id })
        .select('_id user')
        .exec((err, doc) => {
          if (err || !doc) {
            res.status(400).json({ errors: 'No User found' })
          }
          // console.log(doc[0])

          res.status(200).send({ data: { token, data: doc[0] } })
        })
    }
  } catch (error) {
    // console.log(error)
    const errors = handleErrors(error)
    res.send({ errors })
  }
}

const updateUser = async (req, res) => {
  const user = req.profile
  // res.json({ bd: req.body, am: req.profile._id })

  // update user information

  User.findOneAndUpdate(
    { _id: req.profile._id },
    { $set: req.body },
    { new: true },
    (err, doc) => {
      if (err) {
        return res.status(400).json({
          error: 'user could not be updated',
        })
      }
      // res.json(doc)

      Organisation.find({ user: req.profile._id })
        .populate('user', '-password')
        .exec((err, doc) => {
          if (err || !doc) {
            res.status(400).json({ errors: 'No User found' })
          }

          res.status(200).send(doc[0])
        })
    }
  )
}

const checkOldpassword = async (req, res) => {
  // const user = req.profile
  // hash user password and compare with db password
  const { email, password, newpass } = req.body
  const hashedPassword = await hashPassword(newpass)

  try {
    const user = await User.login(email, password)
    if (user) {
      req.body.password = hashedPassword // changes old to new
      User.findOneAndUpdate(
        { _id: req.profile._id },
        { $set: req.body },
        { new: true },
        (err, doc) => {
          if (err) {
            return res.status(400).json({
              error: 'user could not be updated',
            })
          }

          res.json(doc)
        }
      )
    }
  } catch (error) {
    const errors = handleErrors(error)
    res.send({ errors })
  }

  // throw Error('incorrect email')
}

// generate email code for verification
const confirmEmailCode = async (req, res, next) => {
  const user = req.profile

  // generate code
  const emailCode = nanoid(5).toUpperCase()

  // ten minuetes ahead
  var current = new Date().getTime()
  var ten_minutes_from_now = current + 600000

  User.findOneAndUpdate(
    { email: user.email },
    { $set: { code: emailCode } },
    { new: true },
    async (err, user) => {
      if (err) {
        return res.status(400).json({ errors: 'User not found' })
      } else {
        const timers = setTimeout(
          () =>
            User.findOne({ email: user.email }).then((us) => {
              if (!us?.accsetup) {
                User.findOneAndUpdate(
                  { email: user.email },
                  { $set: { codetime_exp: true } },
                  { new: true },
                  (data) => {
                    next()
                  }
                )
              }
              // console.log('timer triggered')
            }),

          600000
        )
        return () => clearTimeout(timers)
      }
    }
  )
  // console.log('email something')
  const data = await ejs.renderFile(path.join(__dirname, '..', 'confirm.ejs'), {
    username: user.name,
    userid: user._id,
    code: emailCode,
  })

  // console.log(user)
  const emailData = {
    from: process.env.Nodemailer_email,
    to: user.email,
    subject: 'Password reset code',
    html: data,
    // <span style="color:red"> ${resetCode}</span>
  }
  // send email
  transporter.sendMail(emailData, (err, data) => {
    // console.log(err, data)
    if (err) {
      res.json({
        errors: false,
        err,
      })
    } else {
      // console.log(data)
      next()
    }
  })
}

// verifies email to be true after code is entered
const verifyEmail = async (req, res) => {
  const { pin } = req.body

  // console.log(req.body.pin)

  User.findOne({ code: req.body.pin })
    .then((user) => {
      if (!user) {
        res.json({ errors: 'Wrong Verification Code' })
      } else {
        // if codetime not expired update verification and account
        if (!user.codetime_exp) {
          User.findOneAndUpdate(
            { code: pin },
            {
              $set: {
                code: '',
                acc_setup: true,
                acc_verify_at: new Date().getTime(),
                codetime_exp: false,
              },
            },
            { new: true },
            async (err, user) => {
              if (err) {
                return res
                  .status(400)
                  .json({ errors: 'soemthing dey go on has expired' })
              } else {
                res.json({ msg: 'successful' })
              }
            }
          )
        } else {
          res.json({ errors: 'Code has Expired' })
        }
      }
    })
    .catch((error) => {
      // console.log('from catch area ', error)
      res.json({ errors: 'Code has Expired' })
    })
}

const requireSignIn = expressJwt({
  secret: process.env.jt,
  userProperty: 'auth',
  algorithms: ['HS256'],
})

const requirevoterSignin = expressJwt({
  secret: process.env.voter,
  userProperty: 'authvoter',
  algorithms: ['HS256'],
})

const isvoterAuth = (req, res, next) => {
  console.log(req.auth)
  // res.send('me')
  let user = req.profile && req.authvoter && req.profile._id == req.auth.id
  console.log(req.auth)
  if (!user) {
    return res.status(403).json({
      error: 'Access denied',
    })
  }
  next()
}

const isAuth = (req, res, next) => {
  console.log(req.auth)
  // res.send('me')
  let user = req.profile && req.auth && req.profile._id == req.auth.id
  console.log(req.auth)
  if (!user) {
    return res.status(403).json({
      error: 'Access denied',
    })
  }
  next()
}

const isAdmin = (req, res, next) => {
  if (req.profile.admin === false) {
    return res.status(403).json({
      error: 'Admin resource! Access denied',
    })
  }
  next()
}

const logout = (req, res) => {
  // console.log(req.cookies)
  // res.cookie('jwt', '', { maxAge: 0 })
  res.cookie('jwt', '', { expires: new Date(0) })
  res.send({ data: true })
}

const forgotPassword = async (req, res) => {
  //email is reset after 5mins or 300,000
  const { email } = req.body
  // console.log(email)

  // generate code
  const resetCode = nanoid(5).toUpperCase()

  User.findOneAndUpdate(
    { email: email },
    { $set: { code: resetCode } },
    { new: true },
    async (err, user) => {
      if (err || !user) {
        return res.json({ errors: 'User does not found' })
      }

      if (user) {
        const data = await ejs.renderFile(
          path.join(__dirname, '..', 'email.ejs'),
          {
            username: user.name,
            userid: user._id,
          }
        )

        // console.log(user)
        const emailData = {
          from: process.env.Nodemailer_email,
          to: user.email,
          subject: 'Password reset code',
          html: data,
          // <span style="color:red"> ${resetCode}</span>
        }
        // send email
        transporter.sendMail(emailData, (err, data) => {
          // console.log(err, data)
          if (err) {
            res.json({
              errors: false,
            })
          } else {
            console.log(data)
            res.json({
              msg: true,
            })
          }
        })

        const timers = setTimeout(
          () =>
            User.findOne({ email: email }).then((us) => {
              if (!us?.accsetup) {
                User.findOneAndUpdate(
                  { email: email },
                  { $set: { code: '' } },
                  { new: true },
                  (data) => {
                    // noting
                  }
                )
              }
              // console.log('timer triggered')
            }),

          300000
        )
      }
      return () => clearTimeout(timers)
    }
  )
}

const resetPassword = async (req, res) => {
  try {
    olduser = req.profile
    const { newpass } = req.body
    // find user based on email and resetCode
    const user = await User.findOne({
      email: olduser.email,
      code: olduser.resetCode,
    })

    // if user not found
    if (!user) {
      res.json({ error: 'Email or reset code is invalid' })
    }
    // if password is short
    if (!newpass || newpass.length < 6) {
      return res.json({
        error: 'Password is required and should be 6 characters long',
      })
    } else {
      // hash password
      user.password = newpass
      user.resetCode = ''
      await user.save()
      res.json({ ok: true })
    }
  } catch (err) {
    console.log(err)
  }
}

const checkResetCode = async (req, res) => {
  user = req.profile
  console.log(user)

  if (!user.code) {
    res.json({ error: true })
  }

  if (user.code) {
    res.json({ ok: true })
  }
}

module.exports = {
  requirevoterSignin,
  requireSignIn,
  updateUser,
  create_User,
  get_User,
  isAuth,
  isAdmin,
  userById,
  logout,
  checkOldpassword,
  forgotPassword,
  resetPassword,
  checkResetCode,
  confirmEmailCode,
  verifyEmail,
}
