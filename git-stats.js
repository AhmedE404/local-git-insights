#!/usr/bin/env node
const child = require('child_process');

/**
 * 1. جلب البيانات من Git
 * %aN: اسم المبرمج
 * %x09: رمز التاب (Tab) كفاصل آمن
 * %aE: إيميل المبرمج (المفتاح الفريد للدمج)
 */
const logData = child.execSync('git log --all --numstat --pretty=format:%aN%x09%aE', {
    encoding: 'utf-8',
    // maxBuffer: 1024 * 1024 * 100 // 100 MB لضمان عدم توقف السكربت مع المشاريع الكبيرة
});

const lines = logData.split(/\r?\n/); // تقسيم المخرجات لسطور (دعم ويندوز وماك)
const stats = {};
let currentAuthorEmail = null;

lines.forEach(line => {
    if (!line) return;

    // فحص السطر: هل هو اسم مبرمج أم أرقام ملفات؟
    if (!/^\d/.test(line)) {
        // إذا كان السطر لا يبدأ برقم، إذن هو سطر [الاسم - التاب - الإيميل]
        let [name, email] = line.split('\t');

        if (email && name && name.trim() !== '-') {
            currentAuthorEmail = email.trim();

            // إنشاء كائن للمبرمج إذا لم يكن موجوداً (التجميع يتم بالإيميل)
            if (!stats[currentAuthorEmail]) {
                stats[currentAuthorEmail] = {
                    Name: name.trim(),
                    Files: 0,
                    Commits: 0,
                    Added: 0,
                    Deleted: 0
                };
            }
            // تحديث الاسم لضمان استخدام أحدث اسم مستخدم لهذا الإيميل
            stats[currentAuthorEmail].Name = name.trim();

            // ✅ يتم زيادة الكوميت هنا (مرة واحدة لكل عملية)
            stats[currentAuthorEmail].Commits += 1;
        }
    } else if (currentAuthorEmail) {
        /**
         * السطر يبدأ برقم، إذن هو سطر إحصائيات ملف: [إضافة - حذف - مسار الملف]
         */
        const [added, deleted, filePath] = line.split(/\s+/);

        // استبعاد الملفات غير البرمجية (صور، صوت، إلخ) باستخدام Regex
        const isBinary = /\.(png|jpg|jpeg|gif|mp3|wav|mp4|mov|zip|exe|pdf|ttf|woff|ico|swp)$/i.test(filePath);

        if (!isNaN(added) && filePath && !isBinary) {
            const author = stats[currentAuthorEmail];
            author.Added += parseInt(added);
            author.Deleted += parseInt(deleted);
            author.Files += 1; // زيادة عدد الملفات الفريدة
        }
    }
});

// 2. معالجة البيانات للعرض في جدول
const finalReport = {};

// ترتيب المبرمجين تنازلياً حسب "صافي العمل" (Net Work)
Object.keys(stats)
    .sort((a, b) => {
        const netA = stats[a].Added - stats[a].Deleted;
        const netB = stats[b].Added - stats[b].Deleted;
        return netB - netA;
    })
    .forEach(email => {
        const data = stats[email];
        if (data.Added > 0) {
            // حساب الأعمدة الإحصائية الإضافية
            finalReport[data.Name] = {
                Files: data.Files,
                Commits: data.Commits,
                Added: data.Added,
                Deleted: data.Deleted,
                Net: data.Added - data.Deleted, // صافي السطور المتبقية
                Avg: Math.round((data.Added + data.Deleted) / data.Files), // كثافة التعديل للملف
                Stability: Math.round((1 - (data.Deleted / data.Added)) * 100) + '%' // نسبة بقاء الكود
            };
        }
    });

// 3. الطباعة النهائية
if (Object.keys(finalReport).length > 0) {
    console.table(finalReport);
} else {
    console.log("لم يتم العثور على مساهمات برمجية نصية.");
}