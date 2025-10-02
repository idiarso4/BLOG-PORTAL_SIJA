const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
    nama: {
        type: String,
        required: [true, 'Nama kategori wajib diisi'],
        trim: true,
        minlength: [2, 'Nama kategori minimal 2 karakter'],
        maxlength: [100, 'Nama kategori maksimal 100 karakter']
    },

    slug: {
        type: String,
        unique: true,
        lowercase: true,
        index: true
    },

    deskripsi: {
        type: String,
        maxlength: [500, 'Deskripsi maksimal 500 karakter'],
        trim: true
    },

    icon: {
        type: String,
        default: 'fas fa-folder',
        trim: true
    },

    color: {
        type: String,
        default: '#6c757d',
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Format warna harus hex color (contoh: #FF5733)']
    },

    // Hierarchical structure
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
        index: true
    },

    // Category settings
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    sortOrder: {
        type: Number,
        default: 0,
        min: 0
    },

    // SEO fields
    seo: {
        metaTitle: {
            type: String,
            maxlength: [60, 'Meta title maksimal 60 karakter'],
            trim: true
        },

        metaDescription: {
            type: String,
            maxlength: [160, 'Meta description maksimal 160 karakter'],
            trim: true
        },

        keywords: [{
            type: String,
            trim: true,
            lowercase: true
        }]
    },

    // Statistics
    stats: {
        articleCount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalViews: {
            type: Number,
            default: 0,
            min: 0
        },

        lastArticleAt: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
categorySchema.index({ nama: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1, isActive: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ createdAt: -1 });

// Virtual for category URL
categorySchema.virtual('url').get(function () {
    return `/kategori/${this.slug}`;
});

// Virtual for full path (breadcrumb)
categorySchema.virtual('fullPath').get(function () {
    // This will be populated by a method since virtuals can't be async
    return this._fullPath || [];
});

// Virtual for has children
categorySchema.virtual('hasChildren').get(function () {
    return this._childrenCount > 0;
});

// Virtual for level (depth in hierarchy)
categorySchema.virtual('level').get(function () {
    return this._level || 0;
});

// Pre-save middleware untuk generate slug
categorySchema.pre('save', function (next) {
    if (this.isModified('nama') || this.isNew) {
        this.slug = this.generateUniqueSlug(this.nama);
    }
    next();
});

// Pre-save middleware untuk validate parent hierarchy
categorySchema.pre('save', async function (next) {
    if (this.isModified('parent') && this.parent) {
        // Check if parent exists
        const parent = await this.constructor.findById(this.parent);
        if (!parent) {
            return next(new Error('Parent category tidak ditemukan'));
        }

        // Prevent circular reference
        if (this.parent.toString() === this._id.toString()) {
            return next(new Error('Category tidak boleh menjadi parent dari dirinya sendiri'));
        }

        // Check for circular reference in hierarchy
        const isCircular = await this.checkCircularReference(this.parent);
        if (isCircular) {
            return next(new Error('Circular reference terdeteksi dalam hierarchy category'));
        }
    }
    next();
});

// Pre-save middleware untuk generate SEO fields
categorySchema.pre('save', function (next) {
    if (this.isModified('nama') || this.isModified('deskripsi')) {
        this.generateSEOFields();
    }
    next();
});

// Method untuk generate unique slug
categorySchema.methods.generateUniqueSlug = function (name) {
    const baseSlug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'id'
    });

    // For categories, we don't need timestamp as they're less frequent
    return baseSlug;
};

// Method untuk generate SEO fields
categorySchema.methods.generateSEOFields = function () {
    if (!this.seo.metaTitle) {
        this.seo.metaTitle = `${this.nama} - Blog Express`;
    }

    if (!this.seo.metaDescription) {
        this.seo.metaDescription = this.deskripsi ||
            `Artikel terbaru dalam kategori ${this.nama} di Blog Express`;
    }
};

// Method untuk check circular reference
categorySchema.methods.checkCircularReference = async function (parentId, visited = new Set()) {
    if (visited.has(parentId.toString())) {
        return true; // Circular reference found
    }

    visited.add(parentId.toString());

    const parent = await this.constructor.findById(parentId);
    if (!parent || !parent.parent) {
        return false; // No circular reference
    }

    return this.checkCircularReference(parent.parent, visited);
};

// Method untuk get full path (breadcrumb)
categorySchema.methods.getFullPath = async function () {
    const path = [];
    let current = this;

    while (current) {
        path.unshift({
            _id: current._id,
            nama: current.nama,
            slug: current.slug,
            url: current.url
        });

        if (current.parent) {
            current = await this.constructor.findById(current.parent);
        } else {
            current = null;
        }
    }

    return path;
};

// Method untuk get children categories
categorySchema.methods.getChildren = function (activeOnly = true) {
    const query = { parent: this._id };
    if (activeOnly) {
        query.isActive = true;
    }

    return this.constructor.find(query).sort({ sortOrder: 1, nama: 1 });
};

// Method untuk get all descendants
categorySchema.methods.getDescendants = async function (activeOnly = true) {
    const descendants = [];
    const children = await this.getChildren(activeOnly);

    for (const child of children) {
        descendants.push(child);
        const childDescendants = await child.getDescendants(activeOnly);
        descendants.push(...childDescendants);
    }

    return descendants;
};

// Method untuk update statistics
categorySchema.methods.updateStats = async function (increment = {}) {
    const updates = {};

    if (increment.articleCount !== undefined) {
        updates['stats.articleCount'] = increment.articleCount;
    }

    if (increment.totalViews !== undefined) {
        updates['stats.totalViews'] = increment.totalViews;
    }

    if (increment.lastArticleAt) {
        updates['stats.lastArticleAt'] = new Date();
    }

    if (Object.keys(updates).length > 0) {
        await this.constructor.updateOne(
            { _id: this._id },
            { $inc: updates }
        );
    }
};

// Static method untuk get root categories
categorySchema.statics.getRootCategories = function (activeOnly = true) {
    const query = { parent: null };
    if (activeOnly) {
        query.isActive = true;
    }

    return this.find(query).sort({ sortOrder: 1, nama: 1 });
};

// Static method untuk get category tree
categorySchema.statics.getCategoryTree = async function (activeOnly = true) {
    const rootCategories = await this.getRootCategories(activeOnly);
    const tree = [];

    for (const root of rootCategories) {
        const rootData = root.toObject();
        rootData.children = await this.buildCategoryTree(root._id, activeOnly);
        tree.push(rootData);
    }

    return tree;
};

// Static method untuk build category tree recursively
categorySchema.statics.buildCategoryTree = async function (parentId, activeOnly = true, level = 1) {
    const query = { parent: parentId };
    if (activeOnly) {
        query.isActive = true;
    }

    const categories = await this.find(query).sort({ sortOrder: 1, nama: 1 });
    const tree = [];

    for (const category of categories) {
        const categoryData = category.toObject();
        categoryData.level = level;
        categoryData.children = await this.buildCategoryTree(category._id, activeOnly, level + 1);
        tree.push(categoryData);
    }

    return tree;
};

// Static method untuk get popular categories
categorySchema.statics.getPopularCategories = function (limit = 10) {
    return this.find({ isActive: true })
        .sort({ 'stats.articleCount': -1, 'stats.totalViews': -1 })
        .limit(limit);
};

// Static method untuk search categories
categorySchema.statics.searchCategories = function (searchTerm) {
    const regex = new RegExp(searchTerm, 'i');

    return this.find({
        isActive: true,
        $or: [
            { nama: regex },
            { deskripsi: regex }
        ]
    }).sort({ 'stats.articleCount': -1 });
};

// Static method untuk get category statistics
categorySchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalCategories: { $sum: 1 },
                activeCategories: { $sum: { $cond: ['$isActive', 1, 0] } },
                rootCategories: { $sum: { $cond: [{ $eq: ['$parent', null] }, 1, 0] } },
                totalArticles: { $sum: '$stats.articleCount' },
                totalViews: { $sum: '$stats.totalViews' }
            }
        }
    ]);

    return stats[0] || {
        totalCategories: 0,
        activeCategories: 0,
        rootCategories: 0,
        totalArticles: 0,
        totalViews: 0
    };
};

// Static method untuk create category with validation
categorySchema.statics.createCategory = async function (categoryData) {
    try {
        const category = new this(categoryData);
        await category.save();
        return category;
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Slug kategori sudah digunakan');
        }
        throw error;
    }
};

module.exports = mongoose.model('Category', categorySchema);