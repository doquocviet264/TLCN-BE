#!/bin/bash
# VNPay Quick Fix Verification
# Check if all fixes are applied correctly

echo "🔍 VNPay Lỗi 70 - FIX VERIFICATION"
echo "===================================="
echo ""

# Check if .env has correct variable name
echo "1️⃣ Checking .env configuration..."
if grep -q "VNP_HASHSECRET=" .env; then
  echo "   ✅ VNP_HASHSECRET found in .env"
else
  echo "   ❌ VNP_HASHSECRET NOT found in .env"
fi

if grep -q "VNP_HASH_SECRET=" .env; then
  echo "   ❌ WARNING: Found old VNP_HASH_SECRET (should be removed)"
else
  echo "   ✅ Old VNP_HASH_SECRET not found"
fi

echo ""

# Check if payment.controller.js uses correct variable
echo "2️⃣ Checking payment.controller.js..."
if grep -q "VNP_HASHSECRET" src/controllers/payment.controller.js; then
  echo "   ✅ Uses VNP_HASHSECRET"
else
  echo "   ❌ Does not use VNP_HASHSECRET"
fi

if grep -q "VNP_HASH_SECRET" src/controllers/payment.controller.js; then
  echo "   ❌ WARNING: Found old VNP_HASH_SECRET (should be fixed)"
else
  echo "   ✅ No old VNP_HASH_SECRET found"
fi

echo ""

# Check if vnpay.controllers.js has buildSignData
echo "3️⃣ Checking vnpay.controllers.js..."
if grep -q "function buildSignData" src/controllers/vnpay.controllers.js; then
  echo "   ✅ buildSignData() function exists"
else
  echo "   ❌ buildSignData() function NOT found"
fi

if grep -q "qs.stringify" src/controllers/vnpay.controllers.js; then
  echo "   ❌ WARNING: Still uses qs.stringify (should be removed)"
else
  echo "   ✅ No qs.stringify found"
fi

echo ""

# Check if import qs exists
echo "4️⃣ Checking imports..."
if grep -q "import qs from" src/controllers/vnpay.controllers.js; then
  echo "   ❌ WARNING: import qs still exists (should be removed)"
else
  echo "   ✅ import qs removed"
fi

echo ""

# Check if verification script exists
echo "5️⃣ Checking verification script..."
if [ -f "verify-vnpay-hash.js" ]; then
  echo "   ✅ verify-vnpay-hash.js exists"
else
  echo "   ❌ verify-vnpay-hash.js NOT found"
fi

echo ""

# Check if documentation exists
echo "6️⃣ Checking documentation..."
if [ -f "VNPAY_DEBUG_GUIDE.md" ]; then
  echo "   ✅ VNPAY_DEBUG_GUIDE.md exists"
else
  echo "   ❌ VNPAY_DEBUG_GUIDE.md NOT found"
fi

if [ -f "VNPAY_FIXES_SUMMARY.md" ]; then
  echo "   ✅ VNPAY_FIXES_SUMMARY.md exists"
else
  echo "   ❌ VNPAY_FIXES_SUMMARY.md NOT found"
fi

echo ""
echo "===================================="
echo "✅ Fix verification complete!"
echo ""
echo "📌 Next steps:"
echo "1. Restart server: npm start"
echo "2. Test payment: node verify-vnpay-hash.js"
echo "3. Monitor logs for VNPAY Sign String & Secure Hash"
echo ""
