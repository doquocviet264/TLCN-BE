import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.js";

function safeUsernameFromEmail(email, fallback) {
  const base = (email?.split("@")[0] || fallback || "user").toLowerCase();
  return `${base}`.slice(0, 30);
}

async function ensureUniqueUsername(base) {
  let uname = base;
  let i = 0;
  while (await User.findOne({ username: uname })) {
    i += 1;
    uname = `${base}-${i}`;
  }
  return uname;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value?.toLowerCase?.() || null;

        // 1) Tìm theo google_id
        let user = await User.findOne({ google_id: profile.id });
        if (user) return done(null, user);

        // 2) Nếu có email, gắn google_id vào user cũ
        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.google_id = profile.id;
            if (!user.avatar && profile.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
          }
        }

        // 3) Tạo user mới (password = null)
        const baseName = safeUsernameFromEmail(email, profile.id);
        const username = await ensureUniqueUsername(baseName);

        const created = await User.create({
          google_id: profile.id,
          fullName: profile.displayName || username,
          email,
          avatar: profile.photos?.[0]?.value,
          username,
          password: null, // user Google không cần password
          isActive: "y",
          status: "y",
        });

        return done(null, created);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Với Mongo, dùng _id
passport.serializeUser((user, done) => done(null, user._id.toString()));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (e) {
    done(e, null);
  }
});

export default passport;
